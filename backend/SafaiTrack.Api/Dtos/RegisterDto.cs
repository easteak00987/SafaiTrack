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

    [Required]
    [RegularExpression(@"^(\+?8801|01)[3-9]\d{8}$", ErrorMessage = "Please enter a valid Bangladeshi mobile number (e.g. +8801991000166 or 01991000166).")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    public string Gender { get; set; } = "Male"; // "Male", "Female", "Other"

    /// <summary>
    /// Ward the account belongs to. A citizen's ward determines who bills them for
    /// waste collection, and a ward officer's determines whose complaints and
    /// invoices they can see.
    /// </summary>
    public int? WardId { get; set; }

    public int? RequestedWardId { get; set; }
}
