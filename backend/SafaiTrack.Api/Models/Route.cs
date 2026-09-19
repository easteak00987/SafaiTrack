namespace SafaiTrack.Api.Models;

public class Route
{
    public int RouteId { get; set; }
    public int WardId { get; set; }
    public string Algorithm { get; set; } = string.Empty;
    public double TotalDistanceKm { get; set; }
    public double? NaiveDistanceKm { get; set; }
    public string Status { get; set; } = "Planned"; // "Planned", "InProgress", "Completed"
    public int? TruckId { get; set; }
    public string? DriverId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Ward? Ward { get; set; }
    public Truck? Truck { get; set; }
    public ApplicationUser? Driver { get; set; }
    public ICollection<RouteStop> RouteStops { get; set; } = new List<RouteStop>();
}
