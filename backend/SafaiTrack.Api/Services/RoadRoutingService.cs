using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace SafaiTrack.Api.Services;

// Shared across requests: one request at a time, >=1.1s spacing, and cached road geometries.
public class RoadRoutingService(IConfiguration configuration, IMemoryCache cache)
{
    private readonly HttpClient client = new() { Timeout = TimeSpan.FromSeconds(20) };
    private readonly SemaphoreSlim gate = new(1, 1);
    private DateTime nextRequest = DateTime.MinValue;

    public async Task<JsonElement> GetAsync(IEnumerable<(double Latitude, double Longitude)> points, CancellationToken ct)
    {
        var coordinates = string.Join(";", points.Select(p =>
            p.Longitude.ToString("F7", CultureInfo.InvariantCulture) + "," + p.Latitude.ToString("F7", CultureInfo.InvariantCulture)));
        var endpoint = configuration["Routing:BaseUrl"] ?? "https://router.project-osrm.org";
        var url = $"{endpoint.TrimEnd('/')}/route/v1/driving/{coordinates}?overview=full&geometries=geojson&steps=true";
        if (cache.TryGetValue<JsonElement>(url, out var cached)) return cached;
        await gate.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue<JsonElement>(url, out cached)) return cached;
            var delay = nextRequest - DateTime.UtcNow;
            if (delay > TimeSpan.Zero) await Task.Delay(delay, ct);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.UserAgent.ParseAdd("SafaiTrack-StudentProject/1.0 (+https://github.com/easteak00987/SafaiTrack)");
            nextRequest = DateTime.UtcNow.AddMilliseconds(1100);
            using var response = await client.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var result = document.RootElement.Clone();
            if (result.GetProperty("code").GetString() != "Ok") throw new HttpRequestException("No road route available.");
            cache.Set(url, result, TimeSpan.FromHours(12));
            return result;
        }
        finally { gate.Release(); }
    }
}
