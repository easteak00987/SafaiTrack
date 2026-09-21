using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Services;

/// <summary>
/// Raises the monthly collection fee for every citizen attached to a ward.
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
        // Bill once at startup so a freshly seeded database has invoices to show,
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
    /// Issues invoices for the calendar month containing <paramref name="asOfUtc"/>.
    /// Returns the number of invoices created.
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
            .Where(u => u.Role == "Citizen" && u.WardId != null)
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

        var pending = billableCitizens
            .Where(c => !alreadyBilled.Contains(c.Id))
            .ToList();

        if (pending.Count == 0)
        {
            return 0;
        }

        // Continue the running sequence for this period so invoice numbers stay unique
        // even when citizens are registered part-way through a month.
        var sequence = alreadyBilled.Count;

        var invoices = pending.Select(citizen => new Invoice
        {
            InvoiceNumber = $"INV-{periodStart:yyyyMM}-{++sequence:D6}",
            CitizenId = citizen.Id,
            WardId = citizen.WardId,
            BillingPeriodStart = periodStart,
            BillingPeriodEnd = periodEnd,
            Amount = _billing.MonthlyFee,
            Currency = _billing.Currency,
            IssuedAt = now,
            DueAt = now.AddDays(_billing.DueAfterDays),
            Status = InvoiceStatus.Unpaid
        }).ToList();

        db.Invoices.AddRange(invoices);

        var notifications = invoices.Select(invoice => new Notification
        {
            UserId = invoice.CitizenId,
            Message =
                $"Your waste collection fee for {periodStart:MMMM yyyy} is " +
                $"{invoice.Amount:0.##} {invoice.Currency}, due {invoice.DueAt:d MMM yyyy}.",
            CreatedAt = now
        });

        db.Notifications.AddRange(notifications);

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Issued {Count} collection-fee invoices for {Period:yyyy-MM}.",
            invoices.Count, periodStart);

        return invoices.Count;
    }
}
