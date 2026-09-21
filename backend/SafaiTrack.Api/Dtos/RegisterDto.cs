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

    /// <summary>
    /// Ward the account belongs to. A citizen's ward determines who bills them for
    /// waste collection, and a ward officer's determines whose complaints and
    /// invoices they can see.
    /// </summary>
    public int? WardId { get; set; }
}
