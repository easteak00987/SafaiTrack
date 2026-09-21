namespace SafaiTrack.Api.Services;

/// <summary>
/// Waste-collection service fee policy, bound from the "Billing" configuration section.
/// </summary>
public class BillingOptions
{
    public const string SectionName = "Billing";

    /// <summary>Standard monthly household collection fee.</summary>
    public decimal MonthlyFee { get; set; } = 150m;

    public string Currency { get; set; } = "BDT";

    /// <summary>Days after issue before an unpaid invoice counts as overdue.</summary>
    public int DueAfterDays { get; set; } = 14;

    /// <summary>
    /// How often the invoice generator wakes to check whether the current month has
    /// been billed. Hourly is ample for a monthly charge and keeps demos responsive.
    /// </summary>
    public int GenerationIntervalHours { get; set; } = 1;
}
