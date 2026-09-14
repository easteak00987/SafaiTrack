namespace SafaiTrack.Api.Models;

public class Bin
{
    public int BinId { get; set; }
    public int WardId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int CurrentFillPercent { get; set; }
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    public Ward? Ward { get; set; }
    public ICollection<Complaint> Complaints { get; set; } = new List<Complaint>();
    public ICollection<RouteStop> RouteStops { get; set; } = new List<RouteStop>();
}
