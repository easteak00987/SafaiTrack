using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;
using Route = SafaiTrack.Api.Models.Route;

namespace SafaiTrack.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class RoutesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IRouteOptimizerService _optimizer;

    public RoutesController(ApplicationDbContext context, IRouteOptimizerService optimizer)
    {
        _context = context;
        _optimizer = optimizer;
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("generate")]
    public async Task<ActionResult<RouteOptimizationResultDto>> GenerateRoute([FromBody] GenerateRouteDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var ward = await _context.Wards.FindAsync(dto.WardId);
        if (ward == null)
        {
            return BadRequest(new { message = $"Ward with ID {dto.WardId} does not exist." });
        }

        var bins = await _context.Bins
            .Where(b => b.WardId == dto.WardId)
            .OrderBy(b => b.BinId)
            .ToListAsync();

        if (bins.Count == 0)
        {
            return BadRequest(new { message = $"Ward with ID {dto.WardId} has no bins configured." });
        }

        RouteOptimizationResultDto result = dto.Algorithm.ToLowerInvariant() switch
        {
            "nearest_neighbor" => _optimizer.ComputeNearestNeighborRoute(bins),
            _ => _optimizer.ComputeDijkstraRoute(bins)
        };

        // Persist the generated route
        var route = new Route
        {
            WardId = dto.WardId,
            Algorithm = result.Algorithm,
            TotalDistanceKm = result.TotalDistanceKm,
            Status = "Planned",
            TruckId = dto.TruckId,
            DriverId = dto.DriverId,
            CreatedAt = DateTime.UtcNow
        };

        await _context.Routes.AddAsync(route);
        await _context.SaveChangesAsync();

        var routeStops = result.OrderedStops.Select(s => new RouteStop
        {
            RouteId = route.RouteId,
            BinId = s.BinId,
            StopSequence = s.StopSequence
        }).ToList();

        await _context.RouteStops.AddRangeAsync(routeStops);
        await _context.SaveChangesAsync();

        // Populate database IDs into the result DTO
        result.RouteId = route.RouteId;
        result.WardId = route.WardId;
        result.Status = route.Status;
        result.TruckId = route.TruckId;
        result.DriverId = route.DriverId;
        result.CreatedAt = route.CreatedAt;

        for (var i = 0; i < result.OrderedStops.Count; i++)
        {
            result.OrderedStops[i].RouteStopId = routeStops[i].RouteStopId;
        }

        return CreatedAtAction(nameof(GetRoute), new { id = route.RouteId }, result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RouteSummaryDto>> GetRoute(int id)
    {
        var route = await _context.Routes
            .Include(r => r.Ward)
            .Include(r => r.Truck)
            .Include(r => r.Driver)
            .Include(r => r.RouteStops)
                .ThenInclude(rs => rs.Bin)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.RouteId == id);

        if (route == null)
        {
            return NotFound(new { message = $"Route with ID {id} not found." });
        }

        var stops = route.RouteStops
            .OrderBy(rs => rs.StopSequence)
            .Select(rs => new OptimizedRouteStopDto
            {
                RouteStopId = rs.RouteStopId,
                BinId = rs.BinId,
                WardId = rs.Bin?.WardId ?? route.WardId,
                Name = rs.Bin?.Name ?? $"Bin {rs.BinId}",
                Latitude = rs.Bin?.Latitude ?? 0,
                Longitude = rs.Bin?.Longitude ?? 0,
                CurrentFillPercent = rs.Bin?.CurrentFillPercent ?? 0,
                StopSequence = rs.StopSequence,
                CollectedAt = rs.CollectedAt
            })
            .ToList();

        var summary = new RouteSummaryDto
        {
            RouteId = route.RouteId,
            WardId = route.WardId,
            WardName = route.Ward?.Name,
            Algorithm = route.Algorithm,
            TotalDistanceKm = route.TotalDistanceKm,
            Status = route.Status,
            TruckId = route.TruckId,
            TruckPlate = route.Truck?.PlateNumber,
            DriverId = route.DriverId,
            DriverName = route.Driver?.FullName,
            CreatedAt = route.CreatedAt,
            StopsCount = stops.Count,
            CollectedStopsCount = stops.Count(s => s.CollectedAt != null),
            Stops = stops
        };

        return Ok(summary);
    }

    [Authorize(Roles = "Driver,Admin")]
    [HttpPut("{id}/start")]
    public async Task<ActionResult<object>> StartRoute(int id)
    {
        var route = await _context.Routes.FindAsync(id);
        if (route == null)
        {
            return NotFound(new { message = $"Route with ID {id} not found." });
        }

        route.Status = "InProgress";
        await _context.SaveChangesAsync();

        return Ok(new { message = "Route started.", routeId = route.RouteId, status = route.Status });
    }

    [Authorize(Roles = "Driver,Admin")]
    [HttpPut("{id}/stops/{stopId}/collect")]
    public async Task<ActionResult<object>> CollectStop(int id, int stopId)
    {
        var routeStop = await _context.RouteStops
            .Include(rs => rs.Bin)
            .FirstOrDefaultAsync(rs => rs.RouteId == id && rs.RouteStopId == stopId);

        if (routeStop == null)
        {
            return NotFound(new { message = $"Stop with ID {stopId} not found on route {id}." });
        }

        routeStop.CollectedAt = DateTime.UtcNow;

        // Optionally empty the bin upon collection
        if (routeStop.Bin != null)
        {
            routeStop.Bin.CurrentFillPercent = 0;
            routeStop.Bin.LastUpdated = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Stop collected.",
            routeId = id,
            stopId = routeStop.RouteStopId,
            binId = routeStop.BinId,
            collectedAt = routeStop.CollectedAt
        });
    }

    [Authorize(Roles = "Driver,Admin")]
    [HttpPut("{id}/complete")]
    public async Task<ActionResult<object>> CompleteRoute(int id)
    {
        var route = await _context.Routes.FindAsync(id);
        if (route == null)
        {
            return NotFound(new { message = $"Route with ID {id} not found." });
        }

        route.Status = "Completed";
        await _context.SaveChangesAsync();

        return Ok(new { message = "Route completed.", routeId = route.RouteId, status = route.Status });
    }
}
