using System.ComponentModel.DataAnnotations;

namespace SafaiTrack.Api.Dtos;

public class GoogleAuthDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? IdToken { get; set; }

    public string? Role { get; set; } = "Citizen";
}

public class ForgotPasswordDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string NewPassword { get; set; } = string.Empty;
}
