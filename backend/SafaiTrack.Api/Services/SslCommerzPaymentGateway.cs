using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace SafaiTrack.Api.Services;

/// <summary>
/// SSLCommerz hosted-checkout integration. SSLCommerz aggregates bKash, Nagad, Rocket
/// and card rails behind a single merchant account, which is why it is used here in
/// preference to integrating each wallet separately.
/// </summary>
public class SslCommerzPaymentGateway : IPaymentGateway
{
    private readonly HttpClient _http;
    private readonly SslCommerzOptions _options;
    private readonly ILogger<SslCommerzPaymentGateway> _logger;

    public SslCommerzPaymentGateway(
        HttpClient http,
        IOptions<SslCommerzOptions> options,
        ILogger<SslCommerzPaymentGateway> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public string Name => "SSLCommerz";

    public async Task<GatewayInitiationResult> InitiateAsync(
        GatewayInitiationRequest request,
        CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["store_id"] = _options.StoreId!,
            ["store_passwd"] = _options.StorePassword!,
            ["total_amount"] = request.Amount.ToString("F2", CultureInfo.InvariantCulture),
            ["currency"] = request.Currency,
            ["tran_id"] = request.TransactionRef,
            ["success_url"] = request.SuccessUrl,
            ["fail_url"] = request.FailUrl,
            ["cancel_url"] = request.CancelUrl,
            ["ipn_url"] = request.IpnUrl,
            ["cus_name"] = request.CustomerName,
            ["cus_email"] = request.CustomerEmail,
            ["cus_phone"] = request.CustomerPhone ?? "N/A",
            ["cus_add1"] = "Dhaka",
            ["cus_city"] = "Dhaka",
            ["cus_country"] = "Bangladesh",
            ["product_name"] = request.ProductDescription,
            ["product_category"] = "Municipal Service",
            ["product_profile"] = "non-physical-goods",
            ["shipping_method"] = "NO"
        };

        try
        {
            using var response = await _http.PostAsync(
                _options.SessionEndpoint, new FormUrlEncodedContent(form), ct);

            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "SSLCommerz session request failed with {StatusCode} for {TransactionRef}.",
                    (int)response.StatusCode, request.TransactionRef);
                return GatewayInitiationResult.Failure(
                    "The payment gateway is not responding. Please try again shortly.");
            }

            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var status = ReadString(root, "status");

            if (!string.Equals(status, "SUCCESS", StringComparison.OrdinalIgnoreCase))
            {
                var reason = ReadString(root, "failedreason") ?? "The gateway rejected the request.";
                _logger.LogWarning(
                    "SSLCommerz refused session for {TransactionRef}: {Reason}",
                    request.TransactionRef, reason);
                return GatewayInitiationResult.Failure(reason);
            }

            var redirectUrl = ReadString(root, "GatewayPageURL");
            if (string.IsNullOrWhiteSpace(redirectUrl))
            {
                return GatewayInitiationResult.Failure(
                    "The gateway did not return a checkout page URL.");
            }

            return GatewayInitiationResult.Success(redirectUrl, ReadString(root, "sessionkey"));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogError(ex,
                "Could not open an SSLCommerz session for {TransactionRef}.", request.TransactionRef);
            return GatewayInitiationResult.Failure(
                "The payment gateway could not be reached. Please try again shortly.");
        }
    }

    public async Task<GatewayValidationResult> ValidateAsync(
        GatewayValidationRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ValidationId))
        {
            return new GatewayValidationResult
            {
                IsValid = false,
                ErrorMessage = "The callback did not carry a validation id."
            };
        }

        var query = $"?val_id={Uri.EscapeDataString(request.ValidationId)}" +
                    $"&store_id={Uri.EscapeDataString(_options.StoreId!)}" +
                    $"&store_passwd={Uri.EscapeDataString(_options.StorePassword!)}" +
                    "&v=1&format=json";

        try
        {
            using var response = await _http.GetAsync(_options.ValidationEndpoint + query, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                return new GatewayValidationResult
                {
                    IsValid = false,
                    RawPayload = body,
                    ErrorMessage = "The gateway validation service returned an error."
                };
            }

            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;

            var status = ReadString(root, "status");
            var settled = string.Equals(status, "VALID", StringComparison.OrdinalIgnoreCase)
                       || string.Equals(status, "VALIDATED", StringComparison.OrdinalIgnoreCase);

            if (!settled)
            {
                return new GatewayValidationResult
                {
                    IsValid = false,
                    RawPayload = body,
                    ErrorMessage = $"The gateway reported this transaction as '{status}'."
                };
            }

            // The transaction id echoed back must be the one we opened the session with,
            // otherwise a valid val_id from another payment could be replayed against
            // this invoice.
            var returnedRef = ReadString(root, "tran_id");
            if (!string.Equals(returnedRef, request.TransactionRef, StringComparison.Ordinal))
            {
                _logger.LogWarning(
                    "SSLCommerz validation returned reference {Returned} for expected {Expected}.",
                    returnedRef, request.TransactionRef);
                return new GatewayValidationResult
                {
                    IsValid = false,
                    RawPayload = body,
                    ErrorMessage = "The gateway response did not match this payment."
                };
            }

            var currency = ReadString(root, "currency");
            var verifiedAmount = ReadDecimal(root, "currency_amount") ?? ReadDecimal(root, "amount");

            // Guard against a tampered redirect claiming a smaller settlement than billed.
            if (verifiedAmount is null
                || verifiedAmount.Value < request.ExpectedAmount
                || !string.Equals(currency, request.ExpectedCurrency, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning(
                    "SSLCommerz settled {Amount} {Currency} against an expected {Expected} {ExpectedCurrency}.",
                    verifiedAmount, currency, request.ExpectedAmount, request.ExpectedCurrency);
                return new GatewayValidationResult
                {
                    IsValid = false,
                    RawPayload = body,
                    VerifiedAmount = verifiedAmount,
                    ErrorMessage = "The settled amount did not match the invoice."
                };
            }

            return new GatewayValidationResult
            {
                IsValid = true,
                GatewayTransactionId = ReadString(root, "bank_tran_id"),
                PaymentMethod = ReadString(root, "card_type"),
                VerifiedAmount = verifiedAmount,
                RawPayload = body
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogError(ex,
                "Could not validate SSLCommerz transaction {TransactionRef}.", request.TransactionRef);
            return new GatewayValidationResult
            {
                IsValid = false,
                ErrorMessage = "The gateway validation service could not be reached."
            };
        }
    }

    private static string? ReadString(JsonElement root, string property) =>
        root.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static decimal? ReadDecimal(JsonElement root, string property)
    {
        if (!root.TryGetProperty(property, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.Number => value.GetDecimal(),
            JsonValueKind.String when decimal.TryParse(
                value.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null
        };
    }
}
