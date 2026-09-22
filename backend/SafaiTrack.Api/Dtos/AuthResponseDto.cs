namespace SafaiTrack.Api.Dtos;

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string? Status { get; set; }
    public string? Message { get; set; }
}
