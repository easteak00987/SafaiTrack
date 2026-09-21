using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Services;

public class BinFillSimulationService(IServiceScopeFactory scopes, ILogger<BinFillSimulationService> logger)
    : BackgroundService
{
    private record BinUpdateResult(int BinId, int OldValue, int NewValue, DateTime Timestamp, int WardId, string BinName);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(3));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await TickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Automatic bin fill update failed; retrying next interval"); }
        }
    }

    public async Task TickAsync(CancellationToken cancellationToken)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE Bins SET CurrentFillPercent = CASE
              WHEN CurrentFillPercent + IncrementValue > 100 THEN 100
              ELSE CurrentFillPercent + IncrementValue END, LastUpdated = SYSUTCDATETIME()
            OUTPUT inserted.BinId, deleted.CurrentFillPercent, inserted.CurrentFillPercent, inserted.LastUpdated, inserted.WardId, inserted.Name
            FROM Bins CROSS APPLY (SELECT 2 + ABS(CONVERT(bigint, CHECKSUM(BinId, @Seed))) % 5 AS IncrementValue) random
            WHERE CurrentFillPercent < 100 AND (ABS(CHECKSUM(BinId, @Seed)) % 4 = 0);
            """;
        var seed = command.CreateParameter();
        seed.ParameterName = "@Seed";
        seed.Value = Guid.NewGuid();
        command.Parameters.Add(seed);

        var updates = new List<BinUpdateResult>();
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                var binId = reader.GetInt32(0);
                var oldVal = reader.GetInt32(1);
                var newVal = reader.GetInt32(2);
                var timestamp = reader.GetDateTime(3);
                var wardId = reader.GetInt32(4);
                var binName = reader.GetString(5);

                updates.Add(new BinUpdateResult(binId, oldVal, newVal, timestamp, wardId, binName));

                logger.LogInformation("Automatic bin fill: BinId={BinId} Old={OldValue} New={NewValue} Timestamp={Timestamp:O}",
                    binId, oldVal, newVal, timestamp);
            }
        }

        // Process threshold alerts (threshold = 80%)
        var thresholdBins = updates.Where(u => u.NewValue >= 80).ToList();
        if (thresholdBins.Count == 0) return;

        var wards = await db.Wards.AsNoTracking().ToDictionaryAsync(w => w.WardId, w => w.Name, cancellationToken);
        var activeOfficers = await db.Users
            .Where(u => u.Role == "WardOfficer" && u.Status == "Active" && u.WardId != null)
            .ToListAsync(cancellationToken);

        var activeRouteBinIds = await db.RouteStops
            .Where(s => s.CollectedAt == null && s.Route!.Status != "Completed" && s.Route.DriverId != null)
            .Select(s => s.BinId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var activeRouteSet = new HashSet<int>(activeRouteBinIds);

        foreach (var b in thresholdBins)
        {
            var wardName = wards.TryGetValue(b.WardId, out var wName) ? wName : $"Ward {b.WardId}";
            var officersInWard = activeOfficers.Where(o => o.WardId == b.WardId).ToList();
            if (officersInWard.Count == 0) continue;

            bool isNewlyOverThreshold = b.OldValue < 80 && b.NewValue >= 80;
            bool isContinuingOverflow = b.OldValue >= 80 && b.NewValue > b.OldValue;

            if (isNewlyOverThreshold)
            {
                // Initial threshold alert
                foreach (var officer in officersInWard)
                {
                    db.Notifications.Add(new Notification
                    {
                        UserId = officer.Id,
                        Title = "Bin Overflow Alert",
                        Message = $"Bin {b.BinName} located in {wardName} has crossed the 80% threshold ({b.NewValue}% full). Immediate collection dispatch required.",
                        Category = "alert",
                        Link = "/operations/bins",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
            else if (isContinuingOverflow && !activeRouteSet.Contains(b.BinId))
            {
                // Bin remains uncollected and continues to fill up without an assigned driver
                foreach (var officer in officersInWard)
                {
                    // Throttle reminders to at most once every 15 minutes per bin per officer
                    bool recentlyReminded = await db.Notifications.AnyAsync(n =>
                        n.UserId == officer.Id &&
                        n.Message.Contains(b.BinName) &&
                        n.CreatedAt > DateTime.UtcNow.AddMinutes(-15), cancellationToken);

                    if (!recentlyReminded)
                    {
                        db.Notifications.Add(new Notification
                        {
                            UserId = officer.Id,
                            Title = "Critical Overflow Reminder",
                            Message = $"Reminder: Bin {b.BinName} in {wardName} is still uncollected and now at {b.NewValue}% capacity! Please assign a collection route.",
                            Category = "alert",
                            Link = "/operations/bins",
                            IsRead = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
