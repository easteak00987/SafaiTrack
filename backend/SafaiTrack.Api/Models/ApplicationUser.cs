using Microsoft.AspNetCore.Identity;

namespace SafaiTrack.Api.Models;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public int? WardId { get; set; }
    public Ward? Ward { get; set; }
    public string Role { get; set; } = "Citizen"; // "Citizen", "Admin", "Driver", "WardOfficer"
    public string Status { get; set; } = "Active"; // "Active", "PendingApproval"
    public string? Gender { get; set; } // "Male", "Female", "Other"
    public int? RequestedWardId { get; set; }
    public Ward? RequestedWard { get; set; }
}
