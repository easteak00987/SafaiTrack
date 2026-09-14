namespace SafaiTrack.Api.Models;

public class RouteStop
{
    public int RouteStopId { get; set; }
    public int RouteId { get; set; }
    public int BinId { get; set; }
    public int StopSequence { get; set; }
    public DateTime? CollectedAt { get; set; }

    public Route? Route { get; set; }
    public Bin? Bin { get; set; }
}
