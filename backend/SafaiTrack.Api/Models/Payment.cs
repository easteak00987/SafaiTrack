namespace SafaiTrack.Api.Models;

/// <summary>
/// One attempt to settle an <see cref="Invoice"/> through a payment gateway.
/// A single invoice may accumulate several payment rows — a failed or abandoned
/// attempt is kept rather than deleted so the ledger stays auditable.
/// </summary>
public class Payment
{
    public int PaymentId { get; set; }

    public int InvoiceId { get; set; }
    public string CitizenId { get; set; } = string.Empty;

    /// <summary>
    /// Our own unique reference for this attempt, sent to the gateway as its
    /// transaction id and echoed back on every callback.
    /// </summary>
    public string TransactionRef { get; set; } = string.Empty;

    /// <summary>Which gateway handled this attempt, e.g. "SSLCommerz" or "Simulated".</summary>
    public string Gateway { get; set; } = string.Empty;

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BDT";

    /// <summary>"Initiated", "Success", "Failed", "Cancelled".</summary>
    public string Status { get; set; } = PaymentStatus.Initiated;

    /// <summary>Gateway session identifier returned when the attempt was initiated.</summary>
    public string? GatewaySessionKey { get; set; }

    /// <summary>The gateway's validation id (SSLCommerz <c>val_id</c>), set on callback.</summary>
    public string? ValidationId { get; set; }

    /// <summary>The bank/issuer transaction id reported by the gateway once settled.</summary>
    public string? GatewayTransactionId { get; set; }

    /// <summary>Instrument the citizen paid with, e.g. "bKash", "Nagad", "VISA".</summary>
    public string? PaymentMethod { get; set; }

    /// <summary>Reason recorded when an attempt did not succeed.</summary>
    public string? FailureReason { get; set; }

    /// <summary>Raw gateway validation response, retained for audit and dispute handling.</summary>
    public string? GatewayPayload { get; set; }

    public DateTime InitiatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public Invoice? Invoice { get; set; }
    public ApplicationUser? Citizen { get; set; }
}

public static class PaymentStatus
{
    public const string Initiated = "Initiated";
    public const string Success = "Success";
    public const string Failed = "Failed";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [Initiated, Success, Failed, Cancelled];
}
