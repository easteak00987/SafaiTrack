namespace SafaiTrack.Api.Models;

public class Notification
{
    public int NotificationId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Category { get; set; } = "info"; // "alert", "warning", "success", "info"
    public string? Link { get; set; }
    public int? RelatedComplaintId { get; set; }
    public Complaint? RelatedComplaint { get; set; }
    public int? RelatedRouteId { get; set; }
    public Route? RelatedRoute { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
