using System.Data;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;
using Route = SafaiTrack.Api.Models.Route;

namespace SafaiTrack.Api.Services;

public class AutomaticRouteService(IServiceScopeFactory scopes, ILogger<AutomaticRouteService> logger) : BackgroundService
{
    // Check periodically with a logical time difference (every 30 minutes)
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan WardCooldown = TimeSpan.FromMinutes(45);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait 5 minutes after server start before running first check so initial manual workflows are unhindered
        try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
        catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(Interval);
        do
        {
            try { await TickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Automatic dispatch cycle failed; will retry next interval"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task TickAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var optimizer = scope.ServiceProvider.GetRequiredService<IRouteOptimizerService>();

        // Find busy driver IDs and busy truck IDs (any driver or truck on an unfinished route)
        var busyDriverIds = await db.Routes
            .Where(r => r.Status != "Completed" && r.DriverId != null)
            .Select(r => r.DriverId!)
            .Distinct()
            .ToListAsync(ct);

        var busyTruckIds = await db.Routes
            .Where(r => r.Status != "Completed" && r.TruckId != null)
            .Select(r => r.TruckId!.Value)
            .Distinct()
            .ToListAsync(ct);

        var wards = await db.Wards.AsNoTracking().ToListAsync(ct);

        foreach (var ward in wards)
        {
            if (ct.IsCancellationRequested) break;

            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            // 1. Skip if this ward already has an active route in progress
            if (await db.Routes.AnyAsync(r => r.WardId == ward.WardId && r.Status != "Completed", ct))
            {
                await tx.CommitAsync(ct);
                continue;
            }

            // 2. Cooldown check: Sufficient time difference (at least 45 minutes since last route was created for this ward)
            var lastRouteCreatedAt = await db.Routes
                .Where(r => r.WardId == ward.WardId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => (DateTime?)r.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (lastRouteCreatedAt.HasValue && (DateTime.UtcNow - lastRouteCreatedAt.Value) < WardCooldown)
            {
                await tx.CommitAsync(ct);
                continue;
            }

            // 3. Check if bins of this ward are "mostly fulfilled"
            var totalBinsInWard = await db.Bins.CountAsync(b => b.WardId == ward.WardId, ct);
            if (totalBinsInWard == 0)
            {
                await tx.CommitAsync(ct);
                continue;
            }

            // Bins needing collection: fill >= 80% or unresolved citizen complaint, not already on an active route
            var fullBins = await db.Bins.Where(b => b.WardId == ward.WardId &&
                (b.CurrentFillPercent >= 80 || db.Complaints.Any(c => c.BinId == b.BinId && c.Status != "Resolved")) &&
                !db.RouteStops.Any(s => s.BinId == b.BinId && s.Route!.Status != "Completed" && s.Route.DriverId != null))
                .OrderBy(b => b.BinId)
                .ToListAsync(ct);

            // "Mostly fulfilled": at least 60% of bins are >=80% full, OR at least 5 bins full
            bool isMostlyFulfilled = fullBins.Count >= 3 && ((double)fullBins.Count / totalBinsInWard >= 0.6 || fullBins.Count >= 5);
            if (!isMostlyFulfilled)
            {
                await tx.CommitAsync(ct);
                continue;
            }

            // 4. Find a free driver: prefer ward-assigned driver, otherwise city-wide pool driver
            var freeDriver = await db.Users
                .Where(u => u.Role == "Driver" && u.Status == "Active" && !busyDriverIds.Contains(u.Id))
                .OrderByDescending(u => u.WardId == ward.WardId)
                .ThenBy(u => u.FullName)
                .FirstOrDefaultAsync(ct);

            // 5. Find a free truck: status Available and not on an active route
            var freeTruck = await db.Trucks
                .Where(t => t.Status == "Available" && !busyTruckIds.Contains(t.TruckId))
                .OrderBy(t => t.TruckId)
                .FirstOrDefaultAsync(ct);

            if (freeDriver == null || freeTruck == null)
            {
                // Route needed, but resources not available. Create a Pending unassigned route and alert the ward officer.
                var resultPending = optimizer.ComputeDijkstraRoute(fullBins);
                var pendingRoute = new Route
                {
                    WardId = ward.WardId,
                    DriverId = null,
                    TruckId = null,
                    Status = "Pending",
                    Algorithm = resultPending.Algorithm,
                    TotalDistanceKm = resultPending.TotalDistanceKm,
                    NaiveDistanceKm = resultPending.NaiveDistanceKm,
                    RouteStops = resultPending.OrderedStops.Select(s => new RouteStop
                    {
                        BinId = s.BinId,
                        StopSequence = s.StopSequence
                    }).ToList()
                };

                db.Routes.Add(pendingRoute);
                await db.SaveChangesAsync(ct);

                var pendingOfficer = await db.Users
                    .Where(u => u.Role == "WardOfficer" && u.WardId == ward.WardId && u.Status == "Active")
                    .FirstOrDefaultAsync(ct);

                if (pendingOfficer != null)
                {
                    string missingReason = (freeDriver == null && freeTruck == null)
                        ? "no truck driver or collection truck is currently available"
                        : freeDriver == null
                            ? "no free truck driver is currently available"
                            : "no collection truck is currently available";

                    db.Notifications.Add(new Notification
                    {
                        UserId = pendingOfficer.Id,
                        RelatedRouteId = pendingRoute.RouteId,
                        Title = "Dispatch Alert: Fleet Unavailable",
                        Message = $"Automatic route #{pendingRoute.RouteId} was created for {ward.Name} ({fullBins.Count} bins full), but {missingReason}. Route saved in Pending. Please monitor and assign crew as soon as available.",
                        Category = "alert",
                        Link = "/operations/routes",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                    await db.SaveChangesAsync(ct);
                }

                logger.LogInformation("Automatic dispatch: Ward {WardName} bins are full ({FullCount}), but driver or truck unavailable. Created Pending Route #{RouteId}.",
                    ward.Name, fullBins.Count, pendingRoute.RouteId);

                await tx.CommitAsync(ct);
                continue;
            }

            // 6. Compute route using optimizer
            var result = optimizer.ComputeDijkstraRoute(fullBins);
            var route = new Route
            {
                WardId = ward.WardId,
                DriverId = freeDriver.Id,
                TruckId = freeTruck.TruckId,
                Status = "AwaitingAcceptance",
                Algorithm = result.Algorithm,
                TotalDistanceKm = result.TotalDistanceKm,
                NaiveDistanceKm = result.NaiveDistanceKm,
                RouteStops = result.OrderedStops.Select(s => new RouteStop
                {
                    BinId = s.BinId,
                    StopSequence = s.StopSequence
                }).ToList()
            };

            db.Routes.Add(route);
            await db.SaveChangesAsync(ct);

            // Mark driver and truck as busy in memory for this tick
            busyDriverIds.Add(freeDriver.Id);
            busyTruckIds.Add(freeTruck.TruckId);

            // 7. Send notifications to Driver and Ward Officer
            db.Notifications.Add(new Notification
            {
                UserId = freeDriver.Id,
                RelatedRouteId = route.RouteId,
                Title = "Automatic Route Dispatched",
                Message = $"Automatic route #{route.RouteId} for {ward.Name} assigned to you with Truck {freeTruck.PlateNumber} ({route.RouteStops.Count} stops). Please accept and begin collection.",
                Category = "info",
                Link = "/driver/route",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            var wardOfficer = await db.Users
                .Where(u => u.Role == "WardOfficer" && u.WardId == ward.WardId && u.Status == "Active")
                .FirstOrDefaultAsync(ct);

            if (wardOfficer != null)
            {
                db.Notifications.Add(new Notification
                {
                    UserId = wardOfficer.Id,
                    RelatedRouteId = route.RouteId,
                    Title = "Automatic Route Dispatched",
                    Message = $"Automatic route #{route.RouteId} generated for {ward.Name} ({fullBins.Count} bins full) and assigned to driver {freeDriver.FullName} with Truck {freeTruck.PlateNumber}.",
                    Category = "info",
                    Link = "/operations/routes",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            logger.LogInformation("Automatic route #{RouteId} generated and assigned to driver {DriverName} and truck {TruckPlate} for {WardName} ({BinCount} stops).",
                route.RouteId, freeDriver.FullName, freeTruck.PlateNumber, ward.Name, route.RouteStops.Count);
        }
    }
}
