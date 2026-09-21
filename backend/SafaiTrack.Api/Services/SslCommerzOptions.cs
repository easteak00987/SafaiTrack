namespace SafaiTrack.Api.Services;

/// <summary>
/// SSLCommerz merchant configuration, bound from the "SslCommerz" configuration section.
/// <para>
/// <see cref="StoreId"/> and <see cref="StorePassword"/> are secrets and must never be
/// committed. Supply them with <c>dotnet user-secrets</c> locally, or environment
/// variables in a deployed environment. When they are absent the API falls back to the
/// simulated gateway so the project still runs for anyone who clones it.
/// </para>
/// </summary>
public class SslCommerzOptions
{
    public const string SectionName = "SslCommerz";

    public string? StoreId { get; set; }
    public string? StorePassword { get; set; }

    /// <summary>Use the sandbox endpoints. Set to false only for a live merchant account.</summary>
    public bool UseSandbox { get; set; } = true;

    /// <summary>Public base URL of this API, used to build the gateway callback URLs.</summary>
    public string ApiBaseUrl { get; set; } = "http://localhost:5281";

    /// <summary>Base URL of the React client, where the citizen is returned after checkout.</summary>
    public string ClientBaseUrl { get; set; } = "http://localhost:3000";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(StoreId) && !string.IsNullOrWhiteSpace(StorePassword);

    public string SessionEndpoint => UseSandbox
        ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
        : "https://securepay.sslcommerz.com/gwprocess/v4/api.php";

    public string ValidationEndpoint => UseSandbox
        ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
        : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";
}
