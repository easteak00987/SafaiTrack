namespace SafaiTrack.Api.Models;

public class Complaint
{
    public int ComplaintId { get; set; }
    public int BinId { get; set; }
    public string CitizenId { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public string Status { get; set; } = "Pending"; // "Pending", "InProgress", "Resolved"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public Bin? Bin { get; set; }
    public ApplicationUser? Citizen { get; set; }
}
