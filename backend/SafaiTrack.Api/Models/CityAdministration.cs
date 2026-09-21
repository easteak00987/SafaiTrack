using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Models;

// A proposal, not an issued invoice. Sending it is an explicit City Admin action.
public class BillingDraft
{
    public int BillingDraftId { get; set; }
    public string CitizenId { get; set; } = "";
    public ApplicationUser Citizen { get; set; } = null!;
    public int WardId { get; set; }
    public Ward Ward { get; set; } = null!;
    public DateTime PeriodStart { get; set; }
    public decimal Amount { get; set; }
    [MaxLength(3)] public string Currency { get; set; } = "BDT";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public string? SentById { get; set; }
    public int? InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }
}

public class RouteActivity
{
    public int RouteActivityId { get; set; }
    public int RouteId { get; set; }
    public Route Route { get; set; } = null!;
    public string ActorId { get; set; } = "";
    public ApplicationUser Actor { get; set; } = null!;
    [MaxLength(30)] public string Action { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class DriverWage
{
    public int DriverWageId { get; set; }
    public string DriverId { get; set; } = "";
    public ApplicationUser Driver { get; set; } = null!;
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public int RoutesCompleted { get; set; }
    public int BinsCollected { get; set; }
    public int RequiredRoutes { get; set; }
    public int RequiredBins { get; set; }
    public decimal BaseAmount { get; set; }
    public decimal PerBinAmount { get; set; }
    public decimal BonusRate { get; set; }
    public decimal BonusAmount { get; set; }
    public decimal Amount { get; set; }
    [MaxLength(30)] public string Status { get; set; } = "Accruing";
    public DateTime? ReleasedAt { get; set; }
    public string? ReleasedById { get; set; }
    public DateTime? DeferredAt { get; set; }
    public DateTime? CollectedAt { get; set; }
    public ICollection<WageContribution> Contributions { get; set; } = new List<WageContribution>();
}

public class WageContribution
{
    public int WageContributionId { get; set; }
    public int DriverWageId { get; set; }
    public DriverWage DriverWage { get; set; } = null!;
    public int RouteId { get; set; }
    public Route Route { get; set; } = null!;
    public int BinsCollected { get; set; }
    public DateTime CompletedAt { get; set; }
}

public class PayrollOptions
{
    public int RequiredRoutes { get; set; } = 1;
    public int RequiredBins { get; set; } = 6;
    public decimal BaseAmount { get; set; } = 800;
    public decimal PerBinAmount { get; set; } = 50;
    public decimal BonusRate { get; set; } = 0.20m;
}
