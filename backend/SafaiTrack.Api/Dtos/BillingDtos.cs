using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Dtos;

public class InvoiceResponseDto
{
    public int InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string CitizenId { get; set; } = string.Empty;
    public string? CitizenName { get; set; }
    public int WardId { get; set; }
    public string? WardName { get; set; }
    public DateTime BillingPeriodStart { get; set; }
    public DateTime BillingPeriodEnd { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BDT";
    public DateTime IssuedAt { get; set; }
    public DateTime DueAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsOverdue { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class PaymentResponseDto
{
    public int PaymentId { get; set; }
    public int InvoiceId { get; set; }
    public string? InvoiceNumber { get; set; }
    public string TransactionRef { get; set; } = string.Empty;
    public string Gateway { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BDT";
    public string Status { get; set; } = string.Empty;
    public string? PaymentMethod { get; set; }
    public string? GatewayTransactionId { get; set; }
    public string? FailureReason { get; set; }
    public DateTime InitiatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class InitiatePaymentDto
{
    [Required]
    public int InvoiceId { get; set; }
}

public class InitiatePaymentResponseDto
{
    /// <summary>Hosted checkout URL the client should send the citizen to.</summary>
    public string RedirectUrl { get; set; } = string.Empty;

    public string TransactionRef { get; set; } = string.Empty;
    public string Gateway { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BDT";
}

/// <summary>Per-ward revenue rollup for the admin analytics dashboard.</summary>
public class WardCollectionSummaryDto
{
    public int WardId { get; set; }
    public string WardName { get; set; } = string.Empty;
    public int TotalInvoices { get; set; }
    public int PaidInvoices { get; set; }
    public int OverdueInvoices { get; set; }
    public decimal AmountBilled { get; set; }
    public decimal AmountCollected { get; set; }
    public decimal AmountOutstanding { get; set; }

    /// <summary>Share of billed value actually collected, 0-100.</summary>
    public double CollectionRate { get; set; }
}

public class BillingSummaryDto
{
    public decimal AmountBilled { get; set; }
    public decimal AmountCollected { get; set; }
    public decimal AmountOutstanding { get; set; }
    public int TotalInvoices { get; set; }
    public int PaidInvoices { get; set; }
    public int OverdueInvoices { get; set; }
    public double CollectionRate { get; set; }
    public string Currency { get; set; } = "BDT";
    public List<WardCollectionSummaryDto> Wards { get; set; } = [];
}
