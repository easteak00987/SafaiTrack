namespace SafaiTrack.Api.Models;

public class Truck
{
    public int TruckId { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public string Status { get; set; } = "Available"; // "Available", "OnRoute", "Maintenance"

    public ICollection<Route> Routes { get; set; } = new List<Route>();
}
