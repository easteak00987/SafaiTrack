using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Dtos;

public class CreateTruckDto
{
    [Required]
    [MaxLength(50)]
    public string PlateNumber { get; set; } = string.Empty;

    public string Status { get; set; } = "Available"; // "Available", "OnRoute", "Maintenance"
}

public class UpdateTruckDto
{
    [MaxLength(50)]
    public string? PlateNumber { get; set; }

    public string? Status { get; set; } // "Available", "OnRoute", "Maintenance"
}

public class TruckResponseDto
{
    public int TruckId { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public string Status { get; set; } = "Available";
}
