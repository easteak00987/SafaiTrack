using System.Net.Mime;
using System.Text.Json;
using Npgsql;

namespace SafaiTrack.Api.Services;

/// <summary>
/// Turns PostgreSQL serialization failures into a 409 Conflict.
/// <para>
/// The dispatch and payment paths run at <c>Serializable</c> isolation. SQL Server
/// implements that with locks, so a competing transaction simply waits. PostgreSQL
/// uses optimistic snapshot isolation instead: the competing transaction proceeds and
/// then fails at commit with SQLSTATE 40001. Without this the caller would see a bare
/// 500 rather than the "someone else got there first" answer the code already models
/// elsewhere with an explicit Conflict result.
/// </para>
/// </summary>
public class SerializationFailureMiddleware(
    RequestDelegate next,
    ILogger<SerializationFailureMiddleware> logger)
{
    /// <summary>serialization_failure — two transactions could not be ordered.</summary>
    private const string SerializationFailure = "40001";

    /// <summary>deadlock_detected — resolved by the server killing one side.</summary>
    private const string DeadlockDetected = "40P01";

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (PostgresException ex)
            when (ex.SqlState is SerializationFailure or DeadlockDetected)
        {
            logger.LogWarning(
                "Concurrent update on {Path} (SQLSTATE {SqlState}); answering 409.",
                context.Request.Path, ex.SqlState);

            if (context.Response.HasStarted)
            {
                // Too late to change the status code; let it surface as a broken
                // response rather than throwing a second exception over the first.
                throw;
            }

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            context.Response.ContentType = MediaTypeNames.Application.Json;

            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                message = "Another update reached this record first. Please retry."
            }));
        }
    }
}
