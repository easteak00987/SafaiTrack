using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;

namespace SafaiTrack.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/workspace")]
public class WorkspaceController(ApplicationDbContext db) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("wards")]
    public async Task<IActionResult> Wards()
    {
        var query = db.Wards.AsNoTracking();
        if (User.Identity?.IsAuthenticated == true && !User.IsInRole("Admin") && !User.IsInRole("Citizen"))
        {
            var user = await db.Users.FindAsync(User.FindFirstValue(ClaimTypes.NameIdentifier));
            if (user?.WardId != null)
                query = query.Where(w => w.WardId == user.WardId);
        }
        return Ok(await query.Select(w => new { w.WardId, w.Name }).ToListAsync());
    }

    [Authorize(Roles = "Admin,WardOfficer")]
    [HttpGet("drivers")]
    public async Task<IActionResult> Drivers()
    {
        var user = await db.Users.FindAsync(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var busyDriverIds = await db.Routes
            .Where(r => r.Status != "Completed" && r.DriverId != null)
            .Select(r => r.DriverId!)
            .ToListAsync();

        var query = db.Users.Where(u => u.Role == "Driver" && u.Status == "Active");
        if (!User.IsInRole("Admin"))
            query = query.Where(u => u.WardId == null || u.WardId == user!.WardId);

        var drivers = await query.OrderBy(u => u.FullName).Select(u => new { u.Id, u.FullName, u.Email, u.WardId }).ToListAsync();
        return Ok(drivers.Select(d => new {
            d.Id,
            d.FullName,
            d.Email,
            d.WardId,
            IsBusy = busyDriverIds.Contains(d.Id)
        }));
    }
}
