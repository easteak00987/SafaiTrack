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
public class BinsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BinsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BinResponseDto>>> GetBins([FromQuery] int? wardId)
    {
        var query = _context.Bins.Include(b => b.Ward).AsNoTracking();

        if (wardId.HasValue)
        {
            query = query.Where(b => b.WardId == wardId.Value);
        }

        var bins = await query
            .Select(b => new BinResponseDto
            {
                BinId = b.BinId,
                WardId = b.WardId,
                Name = b.Name,
                Latitude = b.Latitude,
                Longitude = b.Longitude,
                CurrentFillPercent = b.CurrentFillPercent,
                LastUpdated = b.LastUpdated,
                WardName = b.Ward != null ? b.Ward.Name : null
            })
            .ToListAsync();

        return Ok(bins);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BinResponseDto>> GetBin(int id)
    {
        var bin = await _context.Bins
            .Include(b => b.Ward)
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.BinId == id);

        if (bin == null)
        {
            return NotFound(new { message = $"Bin with ID {id} not found." });
        }

        return Ok(new BinResponseDto
        {
            BinId = bin.BinId,
            WardId = bin.WardId,
            Name = bin.Name,
            Latitude = bin.Latitude,
            Longitude = bin.Longitude,
            CurrentFillPercent = bin.CurrentFillPercent,
            LastUpdated = bin.LastUpdated,
            WardName = bin.Ward?.Name
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<BinResponseDto>> CreateBin([FromBody] CreateBinDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var wardExists = await _context.Wards.AnyAsync(w => w.WardId == dto.WardId);
        if (!wardExists)
        {
            return BadRequest(new { message = $"Ward with ID {dto.WardId} does not exist." });
        }

        var bin = new Bin
        {
            WardId = dto.WardId,
            Name = dto.Name,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            CurrentFillPercent = dto.CurrentFillPercent,
            LastUpdated = DateTime.UtcNow
        };

        await _context.Bins.AddAsync(bin);
        await _context.SaveChangesAsync();

        var ward = await _context.Wards.FindAsync(bin.WardId);

        var responseDto = new BinResponseDto
        {
            BinId = bin.BinId,
            WardId = bin.WardId,
            Name = bin.Name,
            Latitude = bin.Latitude,
            Longitude = bin.Longitude,
            CurrentFillPercent = bin.CurrentFillPercent,
            LastUpdated = bin.LastUpdated,
            WardName = ward?.Name
        };

        return CreatedAtAction(nameof(GetBin), new { id = bin.BinId }, responseDto);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async Task<ActionResult<BinResponseDto>> UpdateBin(int id, [FromBody] UpdateBinDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var bin = await _context.Bins.Include(b => b.Ward).FirstOrDefaultAsync(b => b.BinId == id);
        if (bin == null)
        {
            return NotFound(new { message = $"Bin with ID {id} not found." });
        }

        if (dto.WardId.HasValue && dto.WardId.Value != bin.WardId)
        {
            var wardExists = await _context.Wards.AnyAsync(w => w.WardId == dto.WardId.Value);
            if (!wardExists)
            {
                return BadRequest(new { message = $"Ward with ID {dto.WardId.Value} does not exist." });
            }
            bin.WardId = dto.WardId.Value;
        }

        if (!string.IsNullOrWhiteSpace(dto.Name))
        {
            bin.Name = dto.Name;
        }

        if (dto.Latitude.HasValue)
        {
            bin.Latitude = dto.Latitude.Value;
        }

        if (dto.Longitude.HasValue)
        {
            bin.Longitude = dto.Longitude.Value;
        }

        if (dto.CurrentFillPercent.HasValue)
        {
            bin.CurrentFillPercent = dto.CurrentFillPercent.Value;
        }

        bin.LastUpdated = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new BinResponseDto
        {
            BinId = bin.BinId,
            WardId = bin.WardId,
            Name = bin.Name,
            Latitude = bin.Latitude,
            Longitude = bin.Longitude,
            CurrentFillPercent = bin.CurrentFillPercent,
            LastUpdated = bin.LastUpdated,
            WardName = bin.Ward?.Name
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBin(int id)
    {
        var bin = await _context.Bins
            .Include(b => b.RouteStops)
            .FirstOrDefaultAsync(b => b.BinId == id);

        if (bin == null)
        {
            return NotFound(new { message = $"Bin with ID {id} not found." });
        }

        if (bin.RouteStops.Count != 0)
        {
            return BadRequest(new { message = "Cannot delete bin because it is currently assigned to one or more routes." });
        }

        _context.Bins.Remove(bin);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
