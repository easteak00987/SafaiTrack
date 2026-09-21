namespace SafaiTrack.Api.Models;

public class Notification
{
    public int NotificationId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
    public string Message { get; set; } = string.Empty;
    public int? RelatedComplaintId { get; set; }
    public Complaint? RelatedComplaint { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
