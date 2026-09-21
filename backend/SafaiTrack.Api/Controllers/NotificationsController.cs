using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;

namespace SafaiTrack.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController(ApplicationDbContext db) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.Notifications.AsNoTracking()
        .Where(n => n.UserId == UserId)
        .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.NotificationId)
        .Select(n => new { n.NotificationId, n.Message, n.RelatedComplaintId, n.IsRead, n.CreatedAt })
        .ToListAsync());

    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> Read(int id)
    {
        var notification = await db.Notifications
            .SingleOrDefaultAsync(n => n.NotificationId == id && n.UserId == UserId);
        if (notification == null) return NotFound();
        notification.IsRead = true;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
