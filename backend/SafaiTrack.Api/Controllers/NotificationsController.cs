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
        .Select(n => new
        {
            n.NotificationId,
            Title = !string.IsNullOrEmpty(n.Title) ? n.Title : "Civic Alert",
            n.Message,
            Category = !string.IsNullOrEmpty(n.Category) ? n.Category : "info",
            n.Link,
            n.RelatedComplaintId,
            n.RelatedRouteId,
            n.IsRead,
            n.CreatedAt
        })
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

    [HttpPut("read-all")]
    public async Task<IActionResult> ReadAll()
    {
        var unread = await db.Notifications.Where(n => n.UserId == UserId && !n.IsRead).ToListAsync();
        foreach (var n in unread) n.IsRead = true;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var notification = await db.Notifications
            .SingleOrDefaultAsync(n => n.NotificationId == id && n.UserId == UserId);
        if (notification == null) return NotFound();
        db.Notifications.Remove(notification);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
