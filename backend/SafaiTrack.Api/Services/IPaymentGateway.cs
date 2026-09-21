namespace SafaiTrack.Api.Services;

/// <summary>
/// Abstraction over an external payment gateway.
/// <para>
/// The flow is deliberately two-phase, because that is what every hosted-checkout
/// gateway requires: we ask the gateway to open a session and redirect the citizen
/// to it, and later the gateway calls us back. The callback itself is never trusted —
/// <see cref="ValidateAsync"/> re-asks the gateway what really happened.
/// </para>
/// </summary>
public interface IPaymentGateway
{
    /// <summary>Gateway name recorded on the payment row, e.g. "SSLCommerz".</summary>
    string Name { get; }

    /// <summary>
    /// Opens a checkout session and returns the URL the citizen's browser should be sent to.
    /// </summary>
    Task<GatewayInitiationResult> InitiateAsync(GatewayInitiationRequest request, CancellationToken ct = default);

    /// <summary>
    /// Server-to-server confirmation of a callback. Implementations must verify the
    /// transaction independently rather than believing the posted form values.
    /// </summary>
    Task<GatewayValidationResult> ValidateAsync(GatewayValidationRequest request, CancellationToken ct = default);
}

public class GatewayInitiationRequest
{
    public string TransactionRef { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BDT";
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string ProductDescription { get; set; } = string.Empty;

    /// <summary>Where the gateway sends the citizen's browser after a successful payment.</summary>
    public string SuccessUrl { get; set; } = string.Empty;
    public string FailUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;

    /// <summary>Server-to-server notification endpoint.</summary>
    public string IpnUrl { get; set; } = string.Empty;
}

public class GatewayInitiationResult
{
    public bool Succeeded { get; init; }

    /// <summary>The hosted checkout URL to redirect the citizen to.</summary>
    public string? RedirectUrl { get; init; }

    public string? SessionKey { get; init; }
    public string? ErrorMessage { get; init; }

    public static GatewayInitiationResult Success(string redirectUrl, string? sessionKey) =>
        new() { Succeeded = true, RedirectUrl = redirectUrl, SessionKey = sessionKey };

    public static GatewayInitiationResult Failure(string message) =>
        new() { Succeeded = false, ErrorMessage = message };
}

public class GatewayValidationRequest
{
    public string TransactionRef { get; set; } = string.Empty;

    /// <summary>Gateway-supplied validation handle from the callback (SSLCommerz <c>val_id</c>).</summary>
    public string? ValidationId { get; set; }

    /// <summary>Amount we expect to have been paid, used to detect tampering.</summary>
    public decimal ExpectedAmount { get; set; }

    public string ExpectedCurrency { get; set; } = "BDT";
}

public class GatewayValidationResult
{
    /// <summary>True only when the gateway confirms settlement for the expected amount.</summary>
    public bool IsValid { get; init; }

    public string? GatewayTransactionId { get; init; }
    public string? PaymentMethod { get; init; }
    public decimal? VerifiedAmount { get; init; }
    public string? RawPayload { get; init; }
    public string? ErrorMessage { get; init; }
}
