using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Dtos;

public class GenerateRouteDto
{
    [Required]
    public int WardId { get; set; }

    [Required]
    [RegularExpression("^(dijkstra|nearest_neighbor)$", ErrorMessage = "Algorithm must be 'dijkstra' or 'nearest_neighbor'")]
    public string Algorithm { get; set; } = "dijkstra";

    public int? TruckId { get; set; }
    public string? DriverId { get; set; }
}

public class LocationPointDto
{
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

public class OptimizedRouteStopDto
{
    public int RouteStopId { get; set; }
    public int BinId { get; set; }
    public int WardId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int CurrentFillPercent { get; set; }
    public int StopSequence { get; set; }
    public double LegDistanceKm { get; set; }
    public double CumulativeDistanceKm { get; set; }
    public double XPercent { get; set; }
    public double YPercent { get; set; }
    public DateTime? CollectedAt { get; set; }
}

public class RouteOptimizationResultDto
{
    public int RouteId { get; set; }
    public int WardId { get; set; }
    public string Mode { get; set; } = string.Empty; // "shortest" or "nearest"
    public string Algorithm { get; set; } = string.Empty;
    public string Status { get; set; } = "Planned";
    public int? TruckId { get; set; }
    public string? DriverId { get; set; }
    public DateTime CreatedAt { get; set; }
    public LocationPointDto Depot { get; set; } = new();
    public List<OptimizedRouteStopDto> OrderedStops { get; set; } = [];
    public double TotalDistanceKm { get; set; }
    public double NaiveDistanceKm { get; set; }
    public double DistanceAvoidedKm { get; set; }
    public int PriorityStopsCount { get; set; }
    public int TotalBinsCount { get; set; }
    public int RoadsAvoidedCount { get; set; }
    public string SvgPoints { get; set; } = string.Empty;
}

public class RouteSummaryDto
{
    public int RouteId { get; set; }
    public int WardId { get; set; }
    public string? WardName { get; set; }
    public string Algorithm { get; set; } = string.Empty;
    public double TotalDistanceKm { get; set; }
    public string Status { get; set; } = "Planned";
    public int? TruckId { get; set; }
    public string? TruckPlate { get; set; }
    public string? DriverId { get; set; }
    public string? DriverName { get; set; }
    public DateTime CreatedAt { get; set; }
    public int StopsCount { get; set; }
    public int CollectedStopsCount { get; set; }
    public List<OptimizedRouteStopDto> Stops { get; set; } = [];
}
