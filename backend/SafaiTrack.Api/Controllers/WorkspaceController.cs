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
    [HttpGet("wards")]
    public async Task<IActionResult> Wards()
    {
        var user = await db.Users.FindAsync(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var query = db.Wards.AsNoTracking();
        if (!User.IsInRole("Admin") && !User.IsInRole("Citizen"))
            query = query.Where(w => w.WardId == user!.WardId);
        return Ok(await query.Select(w => new { w.WardId, w.Name }).ToListAsync());
    }

    [Authorize(Roles = "Admin,WardOfficer")]
    [HttpGet("drivers")]
    public async Task<IActionResult> Drivers()
    {
        var user = await db.Users.FindAsync(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var query = db.Users.Where(u => u.Role == "Driver");
        if (!User.IsInRole("Admin")) query = query.Where(u => u.WardId == user!.WardId);
        return Ok(await query.Select(u => new { u.Id, u.FullName, u.WardId }).ToListAsync());
    }
}
