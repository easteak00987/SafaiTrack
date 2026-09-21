using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace SafaiTrack.Api.Services;

/// <summary>
/// Offline stand-in for SSLCommerz, selected automatically when no merchant
/// credentials are configured.
/// <para>
/// It mirrors the same two-phase contract — open a session, redirect, validate the
/// callback server-side — so the billing code exercises an identical path whether or
/// not the sandbox is reachable. This is the same reasoning the project already
/// applies to simulated bin sensors: model the real feed faithfully, so swapping in
/// the real one needs no redesign.
/// </para>
/// </summary>
public class SimulatedPaymentGateway : IPaymentGateway
{
    private readonly SslCommerzOptions _options;
    private readonly ILogger<SimulatedPaymentGateway> _logger;

    /// <summary>
    /// Outcomes recorded by the simulated checkout page, keyed by transaction reference.
    /// In-process only — a restart clears pending attempts, which is acceptable for a
    /// gateway that exists purely for demonstration.
    /// </summary>
    private static readonly ConcurrentDictionary<string, SimulatedOutcome> Outcomes = new();

    public SimulatedPaymentGateway(
        IOptions<SslCommerzOptions> options,
        ILogger<SimulatedPaymentGateway> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public string Name => "Simulated";

    public Task<GatewayInitiationResult> InitiateAsync(
        GatewayInitiationRequest request,
        CancellationToken ct = default)
    {
        Outcomes[request.TransactionRef] = new SimulatedOutcome
        {
            Amount = request.Amount,
            Currency = request.Currency
        };

        _logger.LogInformation(
            "Simulated gateway opened a checkout session for {TransactionRef}.",
            request.TransactionRef);

        var checkoutUrl =
            $"{_options.ApiBaseUrl.TrimEnd('/')}/api/payments/simulated-checkout" +
            $"?tran_id={Uri.EscapeDataString(request.TransactionRef)}";

        return Task.FromResult(
            GatewayInitiationResult.Success(checkoutUrl, $"SIM-SESSION-{request.TransactionRef}"));
    }

    public Task<GatewayValidationResult> ValidateAsync(
        GatewayValidationRequest request,
        CancellationToken ct = default)
    {
        if (!Outcomes.TryGetValue(request.TransactionRef, out var outcome) || !outcome.Approved)
        {
            return Task.FromResult(new GatewayValidationResult
            {
                IsValid = false,
                ErrorMessage = "The simulated gateway has no settled transaction under this reference."
            });
        }

        if (outcome.Amount < request.ExpectedAmount
            || !string.Equals(outcome.Currency, request.ExpectedCurrency, StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(new GatewayValidationResult
            {
                IsValid = false,
                VerifiedAmount = outcome.Amount,
                ErrorMessage = "The settled amount did not match the invoice."
            });
        }

        var payload = JsonSerializer.Serialize(new
        {
            status = "VALID",
            tran_id = request.TransactionRef,
            amount = outcome.Amount,
            currency = outcome.Currency,
            bank_tran_id = outcome.BankTransactionId,
            card_type = outcome.Method,
            gateway = Name
        });

        return Task.FromResult(new GatewayValidationResult
        {
            IsValid = true,
            GatewayTransactionId = outcome.BankTransactionId,
            PaymentMethod = outcome.Method,
            VerifiedAmount = outcome.Amount,
            RawPayload = payload
        });
    }

    /// <summary>
    /// Called by the simulated checkout page when the tester picks an instrument and approves.
    /// </summary>
    public static bool Approve(string transactionRef, string method)
    {
        if (!Outcomes.TryGetValue(transactionRef, out var outcome))
        {
            return false;
        }

        outcome.Approved = true;
        outcome.Method = method;
        outcome.BankTransactionId = $"SIM{DateTime.UtcNow:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
        return true;
    }

    /// <summary>Called when the tester abandons or fails the simulated checkout.</summary>
    public static void Discard(string transactionRef) => Outcomes.TryRemove(transactionRef, out _);

    private sealed class SimulatedOutcome
    {
        public decimal Amount { get; init; }
        public string Currency { get; init; } = "BDT";
        public bool Approved { get; set; }
        public string Method { get; set; } = "Simulated";
        public string BankTransactionId { get; set; } = string.Empty;
    }
}
