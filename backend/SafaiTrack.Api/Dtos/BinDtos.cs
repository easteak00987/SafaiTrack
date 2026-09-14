using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Dtos;

public class CreateBinDto
{
    [Required]
    public int WardId { get; set; }

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Range(-90.0, 90.0)]
    public double Latitude { get; set; }

    [Required]
    [Range(-180.0, 180.0)]
    public double Longitude { get; set; }

    [Range(0, 100)]
    public int CurrentFillPercent { get; set; } = 0;
}

public class UpdateBinDto
{
    [MaxLength(150)]
    public string? Name { get; set; }

    public int? WardId { get; set; }

    [Range(-90.0, 90.0)]
    public double? Latitude { get; set; }

    [Range(-180.0, 180.0)]
    public double? Longitude { get; set; }

    [Range(0, 100)]
    public int? CurrentFillPercent { get; set; }
}

public class BinResponseDto
{
    public int BinId { get; set; }
    public int WardId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int CurrentFillPercent { get; set; }
    public DateTime LastUpdated { get; set; }
    public string? WardName { get; set; }
}
