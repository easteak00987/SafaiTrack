namespace SafaiTrack.Api.Models;

public class ComplaintUpdate
{
    public int ComplaintUpdateId { get; set; }
    public int ComplaintId { get; set; }
    public Complaint? Complaint { get; set; }
    public string AuthorId { get; set; } = "";
    public string AuthorName { get; set; } = "";
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
