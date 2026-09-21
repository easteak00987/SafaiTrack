using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;

namespace SafaiTrack.Api.Services;

public class BinFillSimulationService(IServiceScopeFactory scopes, ILogger<BinFillSimulationService> logger)
    : BackgroundService
{
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
        // UPDATE OUTPUT reads the actual old value atomically, without overwriting a concurrent collection.
        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE Bins SET CurrentFillPercent = CASE
              WHEN CurrentFillPercent + IncrementValue > 100 THEN 100
              ELSE CurrentFillPercent + IncrementValue END, LastUpdated = SYSUTCDATETIME()
            OUTPUT inserted.BinId, deleted.CurrentFillPercent, inserted.CurrentFillPercent, inserted.LastUpdated
            FROM Bins CROSS APPLY (SELECT 1 + ABS(CONVERT(bigint, CHECKSUM(BinId, @Seed))) % 8 AS IncrementValue) random
            WHERE CurrentFillPercent < 100;
            """;
        var seed = command.CreateParameter();
        seed.ParameterName = "@Seed";
        seed.Value = Guid.NewGuid();
        command.Parameters.Add(seed);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            logger.LogInformation("Automatic bin fill: BinId={BinId} Old={OldValue} New={NewValue} Timestamp={Timestamp:O}",
                reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetDateTime(3));
    }
}
