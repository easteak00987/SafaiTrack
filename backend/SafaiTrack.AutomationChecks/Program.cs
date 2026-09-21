using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;
var services = new ServiceCollection();
services.AddScoped<IRouteOptimizerService, RouteOptimizerService>();
services.AddLogging(b => b.AddConsole());
// Point at a scratch database, not the one the app is using — this probe writes and
// deletes rows. Override with SAFAITRACK_CHECKS_CONNECTION.
var checksConnection = Environment.GetEnvironmentVariable("SAFAITRACK_CHECKS_CONNECTION")
    ?? "Host=localhost;Port=5432;Database=safaitrack;Username=postgres;Password=postgres";
services.AddDbContext<ApplicationDbContext>(o => o.UseNpgsql(checksConnection));
using var provider = services.BuildServiceProvider();
using var scope = provider.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
var ward = new Ward { Name = "AutomationProbe-" + Guid.NewGuid() };
db.Wards.Add(ward); await db.SaveChangesAsync();
var bins = new[] {0,99,100}.Select(fill => new Bin { WardId = ward.WardId, Name = "AutomationProbe", CurrentFillPercent = fill }).ToArray();
db.Bins.AddRange(bins); await db.SaveChangesAsync();
try {
    var service = new BinFillSimulationService(provider.GetRequiredService<IServiceScopeFactory>(), provider.GetRequiredService<ILogger<BinFillSimulationService>>());
    await service.TickAsync(default);
    foreach(var bin in bins) await db.Entry(bin).ReloadAsync();
    if (bins[0].CurrentFillPercent < 1 || bins[0].CurrentFillPercent > 8 || bins[1].CurrentFillPercent != 100 || bins[2].CurrentFillPercent != 100)
        throw new Exception("Simulation range/cap failed");
    Console.WriteLine($"PASS simulation: 0->{bins[0].CurrentFillPercent}, 99->100, 100->100");
    var scheduler = new AutomaticRouteService(provider.GetRequiredService<IServiceScopeFactory>(), provider.GetRequiredService<ILogger<AutomaticRouteService>>());
    await scheduler.TickAsync(default); await scheduler.TickAsync(default);
    var routes = await db.Routes.Where(r => r.WardId == ward.WardId).Include(r => r.RouteStops).ToListAsync();
    if (routes.Count != 1 || routes[0].Status != "Pending" || routes[0].DriverId != null || routes[0].TruckId != null || routes[0].RouteStops.Count != 2)
        throw new Exception("Automatic route eligibility or deduplication failed");
    Console.WriteLine($"PASS scheduler: route #{routes[0].RouteId}, Pending, unassigned, 2 qualifying stops; second cycle created no duplicate");
    db.Routes.RemoveRange(routes); await db.SaveChangesAsync();

} finally { db.Bins.RemoveRange(bins); db.Wards.Remove(ward); await db.SaveChangesAsync(); }
