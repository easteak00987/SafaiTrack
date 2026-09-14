using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Controllers;

[Authorize]
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
            .Include(c => c.Bin)
            .Include(c => c.Citizen)
            .AsNoTracking();

        // Citizens can only view their own complaints
        if (!isStaff)
        {
            query = query.Where(c => c.CitizenId == userId);
        }

        var complaints = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new ComplaintResponseDto
            {
                ComplaintId = c.ComplaintId,
                BinId = c.BinId,
                BinName = c.Bin != null ? c.Bin.Name : null,
                CitizenId = c.CitizenId,
                CitizenName = c.Citizen != null ? c.Citizen.FullName : null,
                Category = c.Category,
                Description = c.Description,
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
            .Include(c => c.Bin)
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

        return Ok(new ComplaintResponseDto
        {
            ComplaintId = complaint.ComplaintId,
            BinId = complaint.BinId,
            BinName = complaint.Bin?.Name,
            CitizenId = complaint.CitizenId,
            CitizenName = complaint.Citizen?.FullName,
            Category = complaint.Category,
            Description = complaint.Description,
            Status = complaint.Status,
            CreatedAt = complaint.CreatedAt,
            ResolvedAt = complaint.ResolvedAt
        });
    }

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

        var bin = await _context.Bins.FindAsync(dto.BinId);
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
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        await _context.Complaints.AddAsync(complaint);
        await _context.SaveChangesAsync();

        var responseDto = new ComplaintResponseDto
        {
            ComplaintId = complaint.ComplaintId,
            BinId = complaint.BinId,
            BinName = bin.Name,
            CitizenId = complaint.CitizenId,
            CitizenName = citizen?.FullName,
            Category = complaint.Category,
            Description = complaint.Description,
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
            .Include(c => c.Bin)
            .Include(c => c.Citizen)
            .FirstOrDefaultAsync(c => c.ComplaintId == id);

        if (complaint == null)
        {
            return NotFound(new { message = $"Complaint with ID {id} not found." });
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
            CitizenId = complaint.CitizenId,
            CitizenName = complaint.Citizen?.FullName,
            Category = complaint.Category,
            Description = complaint.Description,
            Status = complaint.Status,
            CreatedAt = complaint.CreatedAt,
            ResolvedAt = complaint.ResolvedAt
        });
    }
}
