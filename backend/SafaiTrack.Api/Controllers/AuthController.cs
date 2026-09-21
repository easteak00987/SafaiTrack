using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        RoleManager<IdentityRole> roleManager,
        ITokenService tokenService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _roleManager = roleManager;
        _tokenService = tokenService;
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

        var user = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            FullName = dto.FullName,
            Role = canonicalRole
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

        var (token, expiresAt) = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            FullName = user.FullName,
            Role = user.Role,
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

        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var (token, expiresAt) = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            FullName = user.FullName,
            Role = user.Role,
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
            Claims = User.Claims.Select(c => new { c.Type, c.Value })
        });
    }
}
