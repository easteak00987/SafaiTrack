using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Dtos;

public class CreateComplaintDto
{
    [Required]
    public int BinId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;
}

public class UpdateComplaintStatusDto
{
    [MaxLength(1000)]
    public string? Message { get; set; }
    [Required]
    public string Status { get; set; } = string.Empty; // "Pending", "InProgress", "Resolved"
}

public class ComplaintResponseDto
{
    public int ComplaintId { get; set; }
    public int BinId { get; set; }
    public string? BinName { get; set; }
    public string CitizenId { get; set; } = string.Empty;
    public string? CitizenName { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
