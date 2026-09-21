using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Controllers;

[Authorize(Roles = "Citizen,Admin,WardOfficer")]
[ApiController]
[Route("api/[controller]")]
public class ComplaintsController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["Pending", "InProgress", "Resolved"];

    private readonly ApplicationDbContext _context;

    public ComplaintsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ComplaintResponseDto>>> GetComplaints()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isStaff = User.IsInRole("Admin") || User.IsInRole("WardOfficer");

        var query = _context.Complaints
            .Include(c => c.Bin).ThenInclude(b => b!.Ward)
            .Include(c => c.Citizen)
            .AsNoTracking();

        // Citizens can only view their own complaints
        if (!isStaff)
        {
            query = query.Where(c => c.CitizenId == userId);
        }
        if (User.IsInRole("WardOfficer"))
        {
            var officer = await _context.Users.FindAsync(userId);
            query = query.Where(c => c.Bin!.WardId == officer!.WardId);
        }

        var complaints = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new ComplaintResponseDto
            {
                ComplaintId = c.ComplaintId,
                BinId = c.BinId,
                BinName = c.Bin != null ? c.Bin.Name : null,
                WardId = c.Bin != null ? c.Bin.WardId : null,
                WardName = c.Bin != null && c.Bin.Ward != null ? c.Bin.Ward.Name : null,
                CitizenId = c.CitizenId,
                CitizenName = c.Citizen != null ? c.Citizen.FullName : null,
                Category = c.Category,
                Description = c.Description,
                PhotoUrl = c.PhotoUrl,
                Status = c.Status,
                CreatedAt = c.CreatedAt,
                ResolvedAt = c.ResolvedAt
            })
            .ToListAsync();

        return Ok(complaints);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ComplaintResponseDto>> GetComplaint(int id)
    {
        var complaint = await _context.Complaints
            .Include(c => c.Bin).ThenInclude(b => b!.Ward)
            .Include(c => c.Citizen)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ComplaintId == id);

        if (complaint == null)
        {
            return NotFound(new { message = $"Complaint with ID {id} not found." });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var isStaff = User.IsInRole("Admin") || User.IsInRole("WardOfficer");

        if (!isStaff && complaint.CitizenId != userId)
        {
            return Forbid();
        }
        if (User.IsInRole("WardOfficer") && complaint.Bin?.WardId != (await _context.Users.FindAsync(userId))?.WardId)
            return Forbid();

        return Ok(new ComplaintResponseDto
        {
            ComplaintId = complaint.ComplaintId,
            BinId = complaint.BinId,
            BinName = complaint.Bin?.Name,
            WardId = complaint.Bin?.WardId,
            WardName = complaint.Bin?.Ward?.Name,
            CitizenId = complaint.CitizenId,
            CitizenName = complaint.Citizen?.FullName,
            Category = complaint.Category,
            Description = complaint.Description,
            PhotoUrl = complaint.PhotoUrl,
            Status = complaint.Status,
            CreatedAt = complaint.CreatedAt,
            ResolvedAt = complaint.ResolvedAt
        });
    }

    [Authorize(Roles = "Citizen")]
    [HttpPost]
    public async Task<ActionResult<ComplaintResponseDto>> CreateComplaint([FromBody] CreateComplaintDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "User not authenticated." });
        }

        var bin = await _context.Bins.Include(b => b.Ward).FirstOrDefaultAsync(b => b.BinId == dto.BinId);
        if (bin == null)
        {
            return BadRequest(new { message = $"Bin with ID {dto.BinId} does not exist." });
        }

        var citizen = await _context.Users.FindAsync(userId);

        var complaint = new Complaint
        {
            BinId = dto.BinId,
            CitizenId = userId,
            Category = dto.Category,
            Description = dto.Description,
            PhotoUrl = dto.PhotoUrl,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        await _context.Complaints.AddAsync(complaint);
        await _context.SaveChangesAsync();

        // 1. Notification to Citizen
        _context.Notifications.Add(new Notification
        {
            UserId = userId,
            RelatedComplaintId = complaint.ComplaintId,
            Title = "Complaint Submitted",
            Message = $"Complaint #{complaint.ComplaintId} ({complaint.Category}) at {bin.Name} reported to Ward Officer and City Admins. Status: Pending.",
            Category = "info",
            Link = $"/citizen/complaints/{complaint.ComplaintId}",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        // 2. Notification to Ward Officer(s)
        var wardOfficers = await _context.Users
            .Where(u => u.Role == "WardOfficer" && u.WardId == bin.WardId && u.Status == "Active")
            .ToListAsync();
        foreach (var officer in wardOfficers)
        {
            _context.Notifications.Add(new Notification
            {
                UserId = officer.Id,
                RelatedComplaintId = complaint.ComplaintId,
                Title = "New Citizen Grievance",
                Message = $"New grievance #{complaint.ComplaintId} ({complaint.Category}) reported at {bin.Name} by {citizen?.FullName ?? "Citizen"}. Requires inspection.",
                Category = "alert",
                Link = $"/ward/complaints/{complaint.ComplaintId}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        // 3. Notification to City Admins
        var admins = await _context.Users
            .Where(u => u.Role == "Admin" && u.Status == "Active")
            .ToListAsync();
        foreach (var admin in admins)
        {
            _context.Notifications.Add(new Notification
            {
                UserId = admin.Id,
                RelatedComplaintId = complaint.ComplaintId,
                Title = "Civic Grievance Logged",
                Message = $"Citizen complaint #{complaint.ComplaintId} ({complaint.Category}) submitted in Ward {bin.WardId} ({bin.Name}).",
                Category = "info",
                Link = $"/admin/complaints/{complaint.ComplaintId}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        var responseDto = new ComplaintResponseDto
        {
            ComplaintId = complaint.ComplaintId,
            BinId = complaint.BinId,
            BinName = bin.Name,
            WardId = bin.WardId,
            WardName = bin.Ward?.Name,
            CitizenId = complaint.CitizenId,
            CitizenName = citizen?.FullName,
            Category = complaint.Category,
            Description = complaint.Description,
            PhotoUrl = complaint.PhotoUrl,
            Status = complaint.Status,
            CreatedAt = complaint.CreatedAt,
            ResolvedAt = complaint.ResolvedAt
        };

        return CreatedAtAction(nameof(GetComplaint), new { id = complaint.ComplaintId }, responseDto);
    }

    [Authorize(Roles = "Admin,WardOfficer")]
    [HttpPut("{id}/status")]
    public async Task<ActionResult<ComplaintResponseDto>> UpdateComplaintStatus(int id, [FromBody] UpdateComplaintStatusDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var matchingStatus = ValidStatuses.FirstOrDefault(s => s.Equals(dto.Status, StringComparison.OrdinalIgnoreCase));
        if (matchingStatus == null)
        {
            return BadRequest(new { message = $"Invalid status. Allowed values are: {string.Join(", ", ValidStatuses)}" });
        }

        var complaint = await _context.Complaints
            .Include(c => c.Bin).ThenInclude(b => b!.Ward)
            .Include(c => c.Citizen)
            .FirstOrDefaultAsync(c => c.ComplaintId == id);

        if (complaint == null)
        {
            return NotFound(new { message = $"Complaint with ID {id} not found." });
        }

        var actor = await _context.Users.FindAsync(User.FindFirstValue(ClaimTypes.NameIdentifier));
        if (User.IsInRole("WardOfficer") && complaint.Bin?.WardId != actor?.WardId) return Forbid();
        if (matchingStatus != complaint.Status && !((complaint.Status == "Pending" && matchingStatus == "InProgress") ||
            (complaint.Status == "InProgress" && matchingStatus == "Resolved")))
            return Conflict(new { message = "Complaints progress from Pending to InProgress to Resolved." });
        if (matchingStatus == complaint.Status && string.IsNullOrWhiteSpace(dto.Message))
            return BadRequest(new { message = "Enter a reply or change the status." });
        _context.ComplaintUpdates.Add(new ComplaintUpdate { ComplaintId = id, AuthorId = actor!.Id,
            AuthorName = actor.FullName, Status = matchingStatus, Message = dto.Message?.Trim() ?? "Status updated." });

        if (matchingStatus == "Resolved")
        {
            var note = !string.IsNullOrWhiteSpace(dto.Message) && dto.Message.Trim() != "Status updated."
                ? $" Note: \"{dto.Message.Trim()}\""
                : "";
            _context.Notifications.Add(new Notification
            {
                UserId = complaint.CitizenId,
                RelatedComplaintId = complaint.ComplaintId,
                Title = "Complaint Resolved",
                Message = $"Your complaint #{id} ({complaint.Category}) at {complaint.Bin?.Name ?? "bin"} was resolved by {actor.FullName}.{note}",
                Category = "success",
                Link = $"/citizen/complaints/{id}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            // Notification to the resolving Ward Officer himself
            if (User.IsInRole("WardOfficer") && actor != null)
            {
                _context.Notifications.Add(new Notification
                {
                    UserId = actor.Id,
                    RelatedComplaintId = complaint.ComplaintId,
                    Title = "Grievance Resolved Successfully",
                    Message = $"You marked Complaint #{id} ({complaint.Category}) at {complaint.Bin?.Name ?? "bin"} as Resolved. Citizen was notified.{note}",
                    Category = "success",
                    Link = $"/operations/complaints/{id}",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        else if (matchingStatus == "InProgress")
        {
            var note = !string.IsNullOrWhiteSpace(dto.Message) && dto.Message.Trim() != "Status updated."
                ? $" Note: \"{dto.Message.Trim()}\""
                : "";
            _context.Notifications.Add(new Notification
            {
                UserId = complaint.CitizenId,
                RelatedComplaintId = complaint.ComplaintId,
                Title = "Complaint In Progress",
                Message = $"Your complaint #{id} status changed to InProgress by {actor.FullName}.{note}",
                Category = "warning",
                Link = $"/citizen/complaints/{id}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
        else if (!string.IsNullOrWhiteSpace(dto.Message))
        {
            var isIssue = dto.Message.Contains("unable", StringComparison.OrdinalIgnoreCase) ||
                          dto.Message.Contains("cannot", StringComparison.OrdinalIgnoreCase) ||
                          dto.Message.Contains("issue", StringComparison.OrdinalIgnoreCase) ||
                          dto.Message.Contains("delay", StringComparison.OrdinalIgnoreCase);
            _context.Notifications.Add(new Notification
            {
                UserId = complaint.CitizenId,
                RelatedComplaintId = complaint.ComplaintId,
                Title = isIssue ? "Complaint Issue Reported" : "Complaint Update",
                Message = isIssue
                    ? $"Issue encountered on complaint #{id} ({complaint.Category}): \"{dto.Message.Trim()}\""
                    : $"Ward Officer reply on complaint #{id}: \"{dto.Message.Trim()}\"",
                Category = isIssue ? "alert" : "info",
                Link = $"/citizen/complaints/{id}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
        complaint.Status = matchingStatus;
        if (matchingStatus == "Resolved")
        {
            complaint.ResolvedAt ??= DateTime.UtcNow;
        }
        else
        {
            complaint.ResolvedAt = null;
        }

        await _context.SaveChangesAsync();

        return Ok(new ComplaintResponseDto
        {
            ComplaintId = complaint.ComplaintId,
            BinId = complaint.BinId,
            BinName = complaint.Bin?.Name,
            WardId = complaint.Bin?.WardId,
            WardName = complaint.Bin?.Ward?.Name,
            CitizenId = complaint.CitizenId,
            CitizenName = complaint.Citizen?.FullName,
            Category = complaint.Category,
            Description = complaint.Description,
            PhotoUrl = complaint.PhotoUrl,
            Status = complaint.Status,
            CreatedAt = complaint.CreatedAt,
            ResolvedAt = complaint.ResolvedAt
        });
    }

    [HttpGet("{id}/updates")]
    public async Task<IActionResult> Updates(int id)
    {
        var complaint = await _context.Complaints.Include(c => c.Bin).FirstOrDefaultAsync(c => c.ComplaintId == id);
        if (complaint == null) return NotFound();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (User.IsInRole("Citizen") && complaint.CitizenId != userId) return Forbid();
        if (User.IsInRole("WardOfficer") && complaint.Bin!.WardId != (await _context.Users.FindAsync(userId))?.WardId) return Forbid();
        return Ok(await _context.ComplaintUpdates.Where(u => u.ComplaintId == id).OrderBy(u => u.CreatedAt)
            .Select(u => new { u.ComplaintUpdateId, u.AuthorName, u.Status, u.Message, u.CreatedAt }).ToListAsync());
    }
}
