using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Dtos;

public class RegisterDto
{
    [Required]
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = "Citizen"; // "Citizen", "Admin", "Driver", "WardOfficer"
}
