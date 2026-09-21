using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Dtos;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;

namespace SafaiTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly string[] AllowedRoles = ["Citizen", "Admin", "Driver", "WardOfficer"];

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly ITokenService _tokenService;
    private readonly ApplicationDbContext _db;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        RoleManager<IdentityRole> roleManager,
        ITokenService tokenService,
        ApplicationDbContext db)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _roleManager = roleManager;
        _tokenService = tokenService;
        _db = db;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var missing = new List<string>();
        if (dto.Password.Length < 8) missing.Add("at least 8 characters");
        if (!System.Text.RegularExpressions.Regex.IsMatch(dto.Password, "[a-z]")) missing.Add("a lowercase letter");
        if (!System.Text.RegularExpressions.Regex.IsMatch(dto.Password, "[A-Z]")) missing.Add("an uppercase letter");
        if (!System.Text.RegularExpressions.Regex.IsMatch(dto.Password, "[0-9]")) missing.Add("a number");
        if (!System.Text.RegularExpressions.Regex.IsMatch(dto.Password, @"[^a-zA-Z0-9\s]")) missing.Add("a special character");
        if (missing.Count > 0)
            return BadRequest(new { message = $"Password requires {string.Join(", ", missing)}." });

        if (!AllowedRoles.Contains(dto.Role, StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = $"Invalid role. Allowed roles are: {string.Join(", ", AllowedRoles)}" });
        }

        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        if (existingUser != null)
        {
            return BadRequest(new { message = "Email is already registered." });
        }

        // Canonical casing for role
        var canonicalRole = AllowedRoles.First(r => r.Equals(dto.Role, StringComparison.OrdinalIgnoreCase));
        var isStaff = canonicalRole is "WardOfficer" or "Driver";

        if (canonicalRole == "WardOfficer")
        {
            if (!dto.RequestedWardId.HasValue)
            {
                return BadRequest(new { message = "Which ward are you applying for? Please select a ward." });
            }
            var wardExists = await _db.Wards.AnyAsync(w => w.WardId == dto.RequestedWardId.Value);
            if (!wardExists)
            {
                return BadRequest(new { message = "Selected ward does not exist." });
            }
        }

        var status = isStaff ? "PendingApproval" : "Active";

        var rawPhone = dto.PhoneNumber?.Trim() ?? "";
        var formattedPhone = rawPhone.StartsWith("+88") ? rawPhone : (rawPhone.StartsWith("88") ? $"+{rawPhone}" : $"+88{rawPhone}");

        var user = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            FullName = dto.FullName,
            PhoneNumber = formattedPhone,
            Gender = dto.Gender,
            Role = canonicalRole,
            Status = status,
            RequestedWardId = canonicalRole == "WardOfficer" ? dto.RequestedWardId : null,
            WardId = null
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description);
            return BadRequest(new { message = "Registration failed.", errors });
        }

        // Ensure the IdentityRole exists and assign it
        if (!await _roleManager.RoleExistsAsync(canonicalRole))
        {
            await _roleManager.CreateAsync(new IdentityRole(canonicalRole));
        }
        await _userManager.AddToRoleAsync(user, canonicalRole);

        if (isStaff)
        {
            return Ok(new AuthResponseDto
            {
                Token = string.Empty,
                FullName = user.FullName,
                Role = user.Role,
                Status = "PendingApproval",
                Message = "Your registration has been submitted and is pending admin approval."
            });
        }

        var (token, expiresAt) = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            FullName = user.FullName,
            Role = user.Role,
            Status = "Active",
            ExpiresAt = expiresAt
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var input = dto.Email?.Trim() ?? "";
        var user = await _userManager.FindByEmailAsync(input) ?? await _userManager.FindByNameAsync(input);
        if (user == null)
        {
            user = await _db.Users.FirstOrDefaultAsync(u => u.FullName.ToLower() == input.ToLower());
        }
        if (user == null && !input.Contains('@'))
        {
            user = await _userManager.FindByEmailAsync($"{input}@safaitrack.local") ?? await _userManager.FindByNameAsync($"{input}@safaitrack.local");
        }
        if (user == null)
        {
            return Unauthorized(new { message = "Invalid email, name, or password." });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (user.Status == "PendingApproval")
        {
            return Unauthorized(new { message = "Your registration is pending admin approval.", status = "PendingApproval" });
        }

        var (token, expiresAt) = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            FullName = user.FullName,
            Role = user.Role,
            Status = user.Status,
            ExpiresAt = expiresAt
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<object>> GetCurrentUser()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "User not found in token." });
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "User does not exist." });
        }

        return Ok(new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.Role,
            user.WardId,
            user.Status,
            user.RequestedWardId,
            Claims = User.Claims.Select(c => new { c.Type, c.Value })
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("pending-approvals")]
    public async Task<IActionResult> GetPendingApprovals()
    {
        var users = await _db.Users
            .Include(u => u.RequestedWard)
            .Where(u => u.Status == "PendingApproval")
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Role,
                u.Status,
                u.RequestedWardId,
                RequestedWardName = u.RequestedWard != null ? u.RequestedWard.Name : null
            })
            .ToListAsync();
        return Ok(users);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("pending-approvals/{id}/approve")]
    public async Task<IActionResult> ApproveUser(string id, [FromBody] ApproveUserDto? dto)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound(new { message = "User not found." });

        user.Status = "Active";

        if (user.Role == "WardOfficer")
        {
            var targetWardId = dto?.WardId ?? user.RequestedWardId;
            if (targetWardId.HasValue)
            {
                var wardExists = await _db.Wards.AnyAsync(w => w.WardId == targetWardId.Value);
                if (!wardExists) return BadRequest(new { message = "Selected ward does not exist." });
                user.WardId = targetWardId.Value;
            }
        }
        else if (user.Role == "Driver")
        {
            if (dto?.WardId.HasValue == true)
            {
                var wardExists = await _db.Wards.AnyAsync(w => w.WardId == dto.WardId.Value);
                if (!wardExists) return BadRequest(new { message = "Selected ward does not exist." });
                user.WardId = dto.WardId.Value;
            }
            else
            {
                user.WardId = null; // city-wide pool
            }
        }

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            return BadRequest(new { message = "Failed to update user status." });
        }

        return Ok(new { message = "User approved successfully.", user.Id, user.Status, user.WardId });
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("pending-approvals/{id}/reject")]
    public async Task<IActionResult> RejectUser(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound(new { message = "User not found." });

        var userRoles = await _db.UserRoles.Where(ur => ur.UserId == id).ToListAsync();
        _db.UserRoles.RemoveRange(userRoles);

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = "Failed to delete user." });
        }

        return Ok(new { message = "User application rejected and account deleted." });
    }
}
