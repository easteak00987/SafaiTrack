using System.Data;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;
using Route = SafaiTrack.Api.Models.Route;

namespace SafaiTrack.Api.Services;

public class AutomaticRouteService(IServiceScopeFactory scopes, ILogger<AutomaticRouteService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(12));
        do
        {
            try { await TickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Automatic dispatch failed; retrying next interval"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task TickAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var optimizer = scope.ServiceProvider.GetRequiredService<IRouteOptimizerService>();
        foreach (var wardId in await db.Wards.AsNoTracking().Select(w => w.WardId).ToListAsync(ct))
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (await db.Routes.AnyAsync(r => r.WardId == wardId && r.Status != "Completed", ct))
            { await tx.CommitAsync(ct); continue; }
            var bins = await db.Bins.Where(b => b.WardId == wardId && (b.CurrentFillPercent > 60 ||
                db.Complaints.Any(c => c.BinId == b.BinId && c.Status != "Resolved")))
                .OrderBy(b => b.BinId).ToListAsync(ct);
            if (bins.Count == 0) { await tx.CommitAsync(ct); continue; }
            var result = optimizer.ComputeDijkstraRoute(bins);
            var route = new Route { WardId = wardId, Status = "Pending", Algorithm = result.Algorithm,
                TotalDistanceKm = result.TotalDistanceKm, NaiveDistanceKm = result.NaiveDistanceKm,
                RouteStops = result.OrderedStops.Select(s => new RouteStop { BinId = s.BinId, StopSequence = s.StopSequence }).ToList() };
            db.Routes.Add(route);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            logger.LogInformation("Automatic route {RouteId} created for ward {WardId}: Pending, unassigned, {StopCount} stops",
                route.RouteId, wardId, route.RouteStops.Count);
        }
    }
}
