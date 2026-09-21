using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;
using Route = SafaiTrack.Api.Models.Route;

namespace SafaiTrack.Api.Controllers;

[Authorize(Roles = "Admin,WardOfficer,Driver")]
[ApiController]
[Route("api/routes")]
public class RoutesController(ApplicationDbContext db, IRouteOptimizerService optimizer, RoadRoutingService roads) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private async Task<IQueryable<Route>> ScopedRoutes()
    {
        var query = db.Routes.AsQueryable();
        if (User.IsInRole("Driver")) return query.Where(r => r.DriverId == UserId);
        if (User.IsInRole("WardOfficer"))
        {
            var user = await db.Users.FindAsync(UserId);
            return query.Where(r => r.WardId == user!.WardId);
        }
        return query;
    }
    private static IQueryable<Route> Details(IQueryable<Route> query) => query
        .Include(r => r.Ward).Include(r => r.Truck).Include(r => r.Driver)
        .Include(r => r.RouteStops).ThenInclude(s => s.Bin);
    private static RouteSummaryDto Summary(Route r) => new()
    {
        RouteId = r.RouteId, WardId = r.WardId, WardName = r.Ward?.Name,
        Algorithm = r.Algorithm, TotalDistanceKm = r.TotalDistanceKm, Status = r.Status,
        DistanceAvoidedKm = r.NaiveDistanceKm.HasValue ? Math.Max(0, r.NaiveDistanceKm.Value - r.TotalDistanceKm) : null,
        TruckId = r.TruckId, TruckPlate = r.Truck?.PlateNumber,
        DriverId = r.DriverId, DriverName = r.Driver?.FullName, CreatedAt = r.CreatedAt,
        StopsCount = r.RouteStops.Count, CollectedStopsCount = r.RouteStops.Count(s => s.CollectedAt != null),
        Stops = r.RouteStops.OrderBy(s => s.StopSequence).Select(s => new OptimizedRouteStopDto
        {
            RouteStopId = s.RouteStopId, BinId = s.BinId, WardId = r.WardId,
            Name = s.Bin!.Name, Latitude = s.Bin.Latitude, Longitude = s.Bin.Longitude,
            CurrentFillPercent = s.Bin.CurrentFillPercent, StopSequence = s.StopSequence, CollectedAt = s.CollectedAt
        }).ToList()
    };
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? wardId)
    {
        var query = await ScopedRoutes();
        if (wardId.HasValue) query = query.Where(r => r.WardId == wardId);
        var routes = await Details(query).AsNoTracking().OrderByDescending(r => r.CreatedAt).ToListAsync();
        return Ok(routes.Select(Summary));
    }
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetRoute(int id)
    {
        var route = await Details(await ScopedRoutes()).AsNoTracking().FirstOrDefaultAsync(r => r.RouteId == id);
        return route == null ? NotFound() : Ok(Summary(route));
    }
    [Authorize(Roles = "Admin,WardOfficer")]
    [HttpPut("{id:int}/assign")]
    public async Task<IActionResult> Assign(int id, AssignRouteDto dto)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var route = await Details(await ScopedRoutes()).FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return NotFound();
        if (route.Status != "Pending" || route.DriverId != null || route.TruckId != null)
            return Conflict(new { message = "Only an unassigned pending route can be assigned." });
        var driver = await db.Users.FirstOrDefaultAsync(u => u.Id == dto.DriverId && u.Role == "Driver" && u.WardId == route.WardId);
        var truck = await db.Trucks.FindAsync(dto.TruckId);
        if (driver == null || truck == null || truck.Status != "Available")
            return BadRequest(new { message = "Select a ward driver and available truck." });
        if (await db.Routes.AnyAsync(r => r.RouteId != id && r.Status != "Completed" && (r.DriverId == dto.DriverId || r.TruckId == dto.TruckId)))
            return Conflict(new { message = "This driver or truck already has an unfinished route." });
        route.DriverId = driver.Id; route.TruckId = truck.TruckId; route.Status = "AwaitingAcceptance";
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return Ok(Summary(route));
    }

    [HttpGet("{id:int}/road")]
    public async Task<IActionResult> Road(int id, CancellationToken ct)
    {
        var route = await Details(await ScopedRoutes()).AsNoTracking().FirstOrDefaultAsync(r => r.RouteId == id, ct);
        if (route == null) return NotFound();
        if (route.RouteStops.Count == 0) return BadRequest(new { message = "This route has no stops." });
        var points = new List<(double Latitude, double Longitude)> { (RouteOptimizerService.DefaultDepot.lat, RouteOptimizerService.DefaultDepot.lon) };
        points.AddRange(route.RouteStops.OrderBy(s => s.StopSequence).Select(s => (s.Bin!.Latitude, s.Bin.Longitude)));
        try { return Ok(await roads.GetAsync(points, ct)); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        { return StatusCode(503, new { message = "Road directions unavailable. Manual collection remains available." }); }
    }

    [Authorize(Roles = "Admin,WardOfficer")]
    [HttpPost("generate")]
    public async Task<IActionResult> Generate(GenerateRouteDto dto)
    {
        var user = await db.Users.FindAsync(UserId);
        if (User.IsInRole("WardOfficer") && user!.WardId != dto.WardId) return Forbid();
        var driver = await db.Users.FirstOrDefaultAsync(u => u.Id == dto.DriverId && u.Role == "Driver" && u.WardId == dto.WardId);
        if (driver == null) return BadRequest(new { message = "Select a driver assigned to this ward." });
        // Reserve the driver, truck, and bins atomically across concurrent dispatches.
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var truck = await db.Trucks.FindAsync(dto.TruckId);
        if (truck == null || truck.Status != "Available") return BadRequest(new { message = "Select an available truck." });
        if (await db.Routes.AnyAsync(r => r.Status != "Completed" && (r.DriverId == dto.DriverId || r.TruckId == dto.TruckId)))
            return Conflict(new { message = "This driver or truck already has an unfinished route." });
        var bins = await db.Bins.Where(b => b.WardId == dto.WardId &&
            (b.CurrentFillPercent > 60 || db.Complaints.Any(c => c.BinId == b.BinId && c.Status != "Resolved")) &&
            !db.RouteStops.Any(s => s.BinId == b.BinId && s.Route!.Status != "Completed" && s.Route.DriverId != null))
            .OrderBy(b => b.BinId).ToListAsync();
        if (bins.Count == 0) return BadRequest(new { message = "No unassigned bins need collection in this ward." });
        var result = dto.Algorithm == "nearest_neighbor" ? optimizer.ComputeNearestNeighborRoute(bins) : optimizer.ComputeDijkstraRoute(bins);
        var pending = await db.Routes.Include(r => r.RouteStops).FirstOrDefaultAsync(r => r.WardId == dto.WardId && r.Status == "Pending" && r.DriverId == null);
        var route = pending ?? new Route { WardId = dto.WardId };
        if (pending != null) db.RouteStops.RemoveRange(pending.RouteStops);
        route.DriverId = driver.Id; route.TruckId = truck.TruckId; route.Status = "AwaitingAcceptance";
        route.Algorithm = result.Algorithm; route.TotalDistanceKm = result.TotalDistanceKm;
        route.NaiveDistanceKm = result.NaiveDistanceKm;
        route.RouteStops = result.OrderedStops.Select(s => new RouteStop { BinId = s.BinId, StopSequence = s.StopSequence }).ToList();
        if (pending == null) db.Routes.Add(route);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return CreatedAtAction(nameof(GetRoute), new { id = route.RouteId }, new { route.RouteId });
    }
    [HttpPut("{id:int}/optimize")]
    public async Task<IActionResult> Optimize(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var route = await Details(await ScopedRoutes()).FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return NotFound();
        if (route.Status != "Planned" && route.Status != "Pending" && route.Status != "AwaitingAcceptance") return Conflict(new { message = "Only a planned route can be optimized." });
        var result = optimizer.ComputeDijkstraRoute(route.RouteStops.Select(s => s.Bin!).ToList());
        foreach (var stop in route.RouteStops) stop.StopSequence = result.OrderedStops.Single(s => s.BinId == stop.BinId).StopSequence;
        route.Algorithm = result.Algorithm;
        route.TotalDistanceKm = result.TotalDistanceKm;
        route.NaiveDistanceKm ??= result.NaiveDistanceKm;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(Summary(route));
    }
    [Authorize(Roles = "Driver")]
    [HttpPut("{id:int}/start")]
    [HttpPut("{id:int}/accept")]
    public async Task<IActionResult> Start(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var route = await Details(await ScopedRoutes()).FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return NotFound();
        if ((route.Status != "Planned" && route.Status != "AwaitingAcceptance") || route.Truck?.Status != "Available" || route.RouteStops.Count == 0)
            return Conflict(new { message = "This route is not ready to start." });
        route.Status = "InProgress";
        route.Truck.Status = "OnRoute";
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(Summary(route));
    }
    [Authorize(Roles = "Driver")]
    [HttpPut("{id:int}/decline")]
    public async Task<IActionResult> Decline(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var route = await Details(await ScopedRoutes()).FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return NotFound();
        if (route.Status != "AwaitingAcceptance" && route.Status != "Planned")
            return Conflict(new { message = "Only a route awaiting acceptance can be declined." });
        route.DriverId = null; route.TruckId = null; route.Status = "Pending";
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return NoContent();
    }
    [Authorize(Roles = "Driver")]
    [HttpPut("{id:int}/stops/{stopId:int}/collect")]
    public async Task<IActionResult> Collect(int id, int stopId)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var route = await Details(await ScopedRoutes()).FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return NotFound();
        var stop = route.RouteStops.FirstOrDefault(s => s.RouteStopId == stopId);
        if (stop == null) return NotFound();
        if (route.Status != "InProgress" || stop.CollectedAt != null ||
            route.RouteStops.Any(s => s.StopSequence < stop.StopSequence && s.CollectedAt == null))
            return Conflict(new { message = "Start the route and collect the next outstanding stop in order." });
        stop.CollectedAt = DateTime.UtcNow;
        stop.Bin!.CurrentFillPercent = 0;
        stop.Bin.LastUpdated = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(Summary(route));
    }
    [Authorize(Roles = "Driver")]
    [HttpPut("{id:int}/complete")]
    public async Task<IActionResult> Complete(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var route = await Details(await ScopedRoutes()).FirstOrDefaultAsync(r => r.RouteId == id);
        if (route == null) return NotFound();
        if (route.Status != "InProgress" || route.RouteStops.Any(s => s.CollectedAt == null))
            return Conflict(new { message = "Collect every stop before completing this route." });
        route.Status = "Completed";
        if (route.Truck != null) route.Truck.Status = "Available";
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(Summary(route));
    }
}
