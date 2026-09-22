using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Controllers;

[Authorize(Roles = "Admin,WardOfficer")]
[ApiController]
[Route("api/[controller]")]
public class TrucksController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["Available", "OnRoute", "Maintenance"];

    private readonly ApplicationDbContext _context;

    public TrucksController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TruckResponseDto>>> GetTrucks()
    {
        var activeTruckIds = await _context.Routes
            .Where(r => r.Status != "Completed" && r.TruckId != null)
            .Select(r => r.TruckId!.Value)
            .ToListAsync();

        var trucks = await _context.Trucks
            .AsNoTracking()
            .ToListAsync();

        return Ok(trucks.Select(t => new TruckResponseDto
        {
            TruckId = t.TruckId,
            PlateNumber = t.PlateNumber,
            Status = activeTruckIds.Contains(t.TruckId) ? "OnRoute" : t.Status
        }));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TruckResponseDto>> GetTruck(int id)
    {
        var truck = await _context.Trucks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TruckId == id);

        if (truck == null)
        {
            return NotFound(new { message = $"Truck with ID {id} not found." });
        }

        return Ok(new TruckResponseDto
        {
            TruckId = truck.TruckId,
            PlateNumber = truck.PlateNumber,
            Status = truck.Status
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<TruckResponseDto>> CreateTruck([FromBody] CreateTruckDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var matchingStatus = ValidStatuses.FirstOrDefault(s => s.Equals(dto.Status, StringComparison.OrdinalIgnoreCase)) ?? "Available";

        var truck = new Truck
        {
            PlateNumber = dto.PlateNumber,
            Status = matchingStatus
        };

        await _context.Trucks.AddAsync(truck);
        await _context.SaveChangesAsync();

        var responseDto = new TruckResponseDto
        {
            TruckId = truck.TruckId,
            PlateNumber = truck.PlateNumber,
            Status = truck.Status
        };

        return CreatedAtAction(nameof(GetTruck), new { id = truck.TruckId }, responseDto);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async Task<ActionResult<TruckResponseDto>> UpdateTruck(int id, [FromBody] UpdateTruckDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var truck = await _context.Trucks.FindAsync(id);
        if (truck == null)
        {
            return NotFound(new { message = $"Truck with ID {id} not found." });
        }

        if (!string.IsNullOrWhiteSpace(dto.PlateNumber))
        {
            if (await _context.Routes.AnyAsync(r => r.TruckId == id && r.Status != "Completed"))
                return Conflict(new { message = "Finish the assigned route before changing this truck." });
        }
        if (!string.IsNullOrWhiteSpace(dto.Status) && await _context.Routes.AnyAsync(r => r.TruckId == id && r.Status != "Completed"))
            return Conflict(new { message = "Finish the assigned route before changing this truck." });
        if (dto.Status == "OnRoute") return BadRequest(new { message = "A truck enters OnRoute when its driver starts a route." });
        if (!string.IsNullOrWhiteSpace(dto.PlateNumber))
        {
            truck.PlateNumber = dto.PlateNumber;
        }

        if (!string.IsNullOrWhiteSpace(dto.Status))
        {
            var matchingStatus = ValidStatuses.FirstOrDefault(s => s.Equals(dto.Status, StringComparison.OrdinalIgnoreCase));
            if (matchingStatus == null)
            {
                return BadRequest(new { message = $"Invalid status. Allowed values are: {string.Join(", ", ValidStatuses)}" });
            }
            truck.Status = matchingStatus;
        }

        await _context.SaveChangesAsync();

        return Ok(new TruckResponseDto
        {
            TruckId = truck.TruckId,
            PlateNumber = truck.PlateNumber,
            Status = truck.Status
        });
    }
}
