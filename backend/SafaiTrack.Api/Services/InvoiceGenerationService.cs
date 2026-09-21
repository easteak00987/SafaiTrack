using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Services;

/// <summary>
/// Prepares monthly billing proposals for every citizen attached to a ward.
/// Runs on the same background-service pattern as the bin-fill and automatic-route
/// services, and is idempotent: a citizen already billed for the current period is skipped.
/// </summary>
public class InvoiceGenerationService(
    IServiceScopeFactory scopes,
    IOptions<BillingOptions> billingOptions,
    ILogger<InvoiceGenerationService> logger) : BackgroundService
{
    private readonly BillingOptions _billing = billingOptions.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Prepare proposals at startup for City Admin review,
        // then settle into the configured cadence.
        try { await GenerateForCurrentPeriodAsync(stoppingToken); }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
        catch (Exception ex) { logger.LogError(ex, "Initial invoice generation failed; retrying next interval"); }

        using var timer = new PeriodicTimer(TimeSpan.FromHours(Math.Max(1, _billing.GenerationIntervalHours)));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await GenerateForCurrentPeriodAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Invoice generation failed; retrying next interval"); }
        }
    }

    /// <summary>
    /// Prepares proposals for the calendar month containing <paramref name="asOfUtc"/>.
    /// Returns the number of proposals created.
    /// </summary>
    public async Task<int> GenerateForCurrentPeriodAsync(
        CancellationToken cancellationToken,
        DateTime? asOfUtc = null)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        if (!await db.Database.CanConnectAsync(cancellationToken))
        {
            logger.LogInformation("Invoice generation skipped: database not reachable.");
            return 0;
        }

        var now = asOfUtc ?? DateTime.UtcNow;
        var periodStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var periodEnd = periodStart.AddMonths(1).AddTicks(-1);

        // Only citizens assigned to a ward can be billed — the fee is a ward service charge.
        var billableCitizens = await db.Users
            .Where(u => u.Role == "Citizen" && u.Status == "Active" && u.WardId != null)
            .Select(u => new { u.Id, WardId = u.WardId!.Value })
            .ToListAsync(cancellationToken);

        if (billableCitizens.Count == 0)
        {
            return 0;
        }

        var alreadyBilled = await db.Invoices
            .Where(i => i.BillingPeriodStart == periodStart)
            .Select(i => i.CitizenId)
            .ToListAsync(cancellationToken);

        alreadyBilled.AddRange(await db.BillingDrafts.Where(d => d.PeriodStart == periodStart).Select(d => d.CitizenId).ToListAsync(cancellationToken));

        var pending = billableCitizens
            .Where(c => !alreadyBilled.Contains(c.Id))
            .ToList();

        if (pending.Count == 0)
        {
            return 0;
        }

        var drafts = pending.Select(c => new BillingDraft {
            CitizenId = c.Id, WardId = c.WardId, PeriodStart = periodStart,
            Amount = _billing.MonthlyFee, Currency = _billing.Currency, CreatedAt = now
        }).ToList();
        db.BillingDrafts.AddRange(drafts);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Prepared {Count} billing proposals for {Period:yyyy-MM}", drafts.Count, periodStart);
        return drafts.Count;
    }
}
