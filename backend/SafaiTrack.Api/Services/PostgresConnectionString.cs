using Npgsql;

namespace SafaiTrack.Api.Services;

/// <summary>
/// Translates a <c>postgres://</c> URI into the key/value form Npgsql expects.
/// </summary>
public static class PostgresConnectionString
{
    public static string FromUrl(string databaseUrl)
    {
        if (string.IsNullOrWhiteSpace(databaseUrl))
        {
            throw new ArgumentException("The database URL is empty.", nameof(databaseUrl));
        }

        if (!databaseUrl.Contains("://", StringComparison.Ordinal))
        {
            return databaseUrl;
        }

        if (!Uri.TryCreate(databaseUrl, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException($"'{databaseUrl}' is not a valid database URL.", nameof(databaseUrl));
        }

        var userInfo = uri.UserInfo.Split(':', 2);

        var b = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            SslMode = SslMode.Require,
            MaxPoolSize = 10,
            Timeout = 30,
            CommandTimeout = 60
        };

        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var sslMode = query["sslmode"];
        if (!string.IsNullOrWhiteSpace(sslMode) && Enum.TryParse<SslMode>(sslMode, ignoreCase: true, out var parsed))
        {
            b.SslMode = parsed;
        }

        return b.ConnectionString;
    }
}
