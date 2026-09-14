namespace SafaiTrack.Api.Models;

public class Ward
{
    public int WardId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ICollection<Bin> Bins { get; set; } = new List<Bin>();
    public ICollection<Route> Routes { get; set; } = new List<Route>();
}
