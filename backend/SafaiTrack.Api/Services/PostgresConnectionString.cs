using Npgsql;

namespace SafaiTrack.Api.Services;

/// <summary>
/// Translates a <c>postgres://</c> URI into the key/value form Npgsql expects.
/// <para>
/// Render, Neon, Supabase, Heroku and most managed Postgres providers hand out the
/// database as a URI in <c>DATABASE_URL</c>. Npgsql does not accept that format, so
/// it has to be converted before use.
/// </para>
/// </summary>
public static class PostgresConnectionString
{
    public static string FromUrl(string databaseUrl)
    {
        if (string.IsNullOrWhiteSpace(databaseUrl))
        {
            throw new ArgumentException("The database URL is empty.", nameof(databaseUrl));
        }

        // Already a key/value connection string — nothing to translate.
        if (!databaseUrl.Contains("://", StringComparison.Ordinal))
        {
            return databaseUrl;
        }

        if (!Uri.TryCreate(databaseUrl, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException(
                $"'{databaseUrl}' is not a valid database URL.", nameof(databaseUrl));
        }

        var userInfo = uri.UserInfo.Split(':', 2);

        var b = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            // Credentials arrive percent-encoded inside the URI.
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,

            // Managed Postgres requires TLS but presents a certificate chain the
            // container does not have roots for, so verification is not possible.
            SslMode = SslMode.Require,

            // Free tiers cap connections tightly and idle the database out, so keep
            // the pool small and let broken connections be discarded rather than reused.
            MaxPoolSize = 10,
            Timeout = 30,
            CommandTimeout = 60
        };

        // Honour an explicit sslmode in the URI query if one was supplied.
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var sslMode = query["sslmode"];
        if (!string.IsNullOrWhiteSpace(sslMode)
            && Enum.TryParse<SslMode>(sslMode, ignoreCase: true, out var parsed))
        {
            b.SslMode = parsed;
        }

        return b.ConnectionString;
    }
}
