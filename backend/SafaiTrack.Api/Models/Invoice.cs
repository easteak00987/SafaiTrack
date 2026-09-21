namespace SafaiTrack.Api.Models;

/// <summary>
/// A monthly waste-collection service fee raised against one household (citizen)
/// for one ward and one billing period.
/// </summary>
public class Invoice
{
    public int InvoiceId { get; set; }

    /// <summary>Human-readable reference shown to the citizen, e.g. "INV-202609-000042".</summary>
    public string InvoiceNumber { get; set; } = string.Empty;

    public string CitizenId { get; set; } = string.Empty;
    public int WardId { get; set; }

    /// <summary>First day of the month being billed (UTC).</summary>
    public DateTime BillingPeriodStart { get; set; }

    /// <summary>Last day of the month being billed (UTC).</summary>
    public DateTime BillingPeriodEnd { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BDT";

    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime DueAt { get; set; }

    /// <summary>"Unpaid", "Processing", "Paid", "Cancelled".</summary>
    public string Status { get; set; } = InvoiceStatus.Unpaid;

    public DateTime? PaidAt { get; set; }

    public ApplicationUser? Citizen { get; set; }
    public Ward? Ward { get; set; }
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public bool IsOverdue(DateTime asOfUtc) =>
        Status == InvoiceStatus.Unpaid && asOfUtc > DueAt;
}

public static class InvoiceStatus
{
    public const string Unpaid = "Unpaid";
    public const string Processing = "Processing";
    public const string Paid = "Paid";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [Unpaid, Processing, Paid, Cancelled];
}
