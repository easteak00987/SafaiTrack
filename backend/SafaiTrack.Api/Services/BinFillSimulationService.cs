using System.Data;
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
        var connection = db.Database.GetDbConnection();

        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();

        // PostgreSQL's RETURNING only exposes the new row, so the pre-update value is
        // captured in a CTE. FOR UPDATE locks those rows for the statement, which is
        // what stops a concurrent collection being overwritten — the same guarantee
        // the previous SQL Server UPDATE ... OUTPUT deleted.* provided.
        //
        // random() is volatile and so is evaluated once per row, giving each bin its
        // own increment of 1-8 without needing an explicit seed.
        command.CommandText = """
            WITH locked AS (
                SELECT "BinId", "CurrentFillPercent" AS old_fill
                FROM "Bins"
                WHERE "CurrentFillPercent" < 100
                ORDER BY "BinId"
                FOR UPDATE
            )
            UPDATE "Bins" AS b
            SET "CurrentFillPercent" = LEAST(l.old_fill + (floor(random() * 8)::int + 1), 100),
                "LastUpdated" = now()
            FROM locked AS l
            WHERE b."BinId" = l."BinId"
            RETURNING b."BinId", l.old_fill, b."CurrentFillPercent", b."LastUpdated";
            """;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            logger.LogInformation("Automatic bin fill: BinId={BinId} Old={OldValue} New={NewValue} Timestamp={Timestamp:O}",
                reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetDateTime(3));
    }
}
