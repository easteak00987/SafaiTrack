using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;
using Route = SafaiTrack.Api.Models.Route;

namespace SafaiTrack.Api.Services;

public class PayrollService(ApplicationDbContext db, IOptions<PayrollOptions> options)
{
    // Called inside the route completion transaction; a unique RouteId prevents double accrual.
    public async Task RecordCompletionAsync(Route route, DateTime now)
    {
        if (route.DriverId == null || await db.WageContributions.AnyAsync(c => c.RouteId == route.RouteId)) return;
        var wage = await db.DriverWages.FirstOrDefaultAsync(w => w.DriverId == route.DriverId && w.PeriodStart <= now && w.PeriodEnd > now);
        if (wage == null)
        {
            var policy = options.Value;
            wage = new DriverWage {
                DriverId = route.DriverId, PeriodStart = now, PeriodEnd = now.AddHours(24),
                RequiredRoutes = Math.Max(1, policy.RequiredRoutes), RequiredBins = Math.Max(1, policy.RequiredBins),
                BaseAmount = policy.BaseAmount, PerBinAmount = policy.PerBinAmount, BonusRate = policy.BonusRate
            };
            db.DriverWages.Add(wage);
        }
        var bins = route.RouteStops.Count(s => s.CollectedAt != null);
        wage.Contributions.Add(new WageContribution { RouteId = route.RouteId, BinsCollected = bins, CompletedAt = now });
        wage.RoutesCompleted++;
        wage.BinsCollected += bins;
        var subtotal = wage.BaseAmount + wage.BinsCollected * wage.PerBinAmount;
        wage.BonusAmount = wage.BinsCollected >= wage.RequiredBins ? decimal.Round(subtotal * wage.BonusRate, 2) : 0;
        wage.Amount = subtotal + wage.BonusAmount;
    }

    public static bool Eligible(DriverWage wage, DateTime now) => wage.PeriodEnd <= now
        && wage.RoutesCompleted >= wage.RequiredRoutes && wage.BinsCollected >= wage.RequiredBins;

    public static object View(DriverWage w) => new {
        w.DriverWageId, w.DriverId, DriverName = w.Driver?.FullName, PhoneNumber = w.Driver?.PhoneNumber,
        w.PeriodStart, w.PeriodEnd, w.RoutesCompleted, w.BinsCollected, w.RequiredRoutes, w.RequiredBins,
        w.BaseAmount, w.PerBinAmount, w.BonusAmount, w.Amount, w.Status, w.ReleasedAt, w.CollectedAt, w.DeferredAt,
        Eligible = w.Status == "Accruing" && Eligible(w, DateTime.UtcNow)
    };
}
