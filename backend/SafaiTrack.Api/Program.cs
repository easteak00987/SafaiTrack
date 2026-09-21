using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using SafaiTrack.Api.Data;
using SafaiTrack.Api.Models;
using SafaiTrack.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Render (and most managed Postgres providers) inject the database as a URI in
// DATABASE_URL, which Npgsql cannot parse. Translate it when present; a normal
// key/value connection string in configuration still wins.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    if (!string.IsNullOrWhiteSpace(databaseUrl))
    {
        connectionString = PostgresConnectionString.FromUrl(databaseUrl);
    }
}

// Render assigns the port to bind at runtime rather than letting the app choose.
// This deliberately overrides ASPNETCORE_URLS — the image sets that as a fallback
// for running outside Render, but where PORT exists it is the authoritative value.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// 1. Configure DbContext with PostgreSQL from configuration
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (!string.IsNullOrEmpty(connectionString))
    {
        options.UseNpgsql(connectionString);
    }
});

// 2. Configure ASP.NET Core Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// 3. Configure JWT Bearer Authentication
var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SafaiTrack.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "SafaiTrack.Client";

if (string.IsNullOrWhiteSpace(jwtKey))
{
    // The development fallback must never reach a deployed environment: this key is
    // in a public repository, and anyone holding it can mint tokens for any role.
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "Jwt:Key must be configured outside Development. Set it as an environment " +
            "variable or platform secret before starting the API.");
    }

    jwtKey = "SafaiTrack_SuperSecret_Jwt_SigningKey_2026_DevEnvironment_AtLeast32Chars!";

    // TokenService resolves the key from configuration, so the fallback has to live
    // there too rather than only in this local.
    builder.Configuration["Jwt:Key"] = jwtKey;
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// 4. Register custom application services
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IRouteOptimizerService, RouteOptimizerService>();
builder.Services.AddHostedService<BinFillSimulationService>();
builder.Services.AddHostedService<AutomaticRouteService>();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<RoadRoutingService>();

// 4a. Billing and payments
builder.Services.Configure<BillingOptions>(
    builder.Configuration.GetSection(BillingOptions.SectionName));
builder.Services.Configure<SslCommerzOptions>(
    builder.Configuration.GetSection(SslCommerzOptions.SectionName));

// Registered as a singleton so the controller can trigger a billing run on demand
// while the same instance also drives the hourly background pass.
builder.Services.AddSingleton<InvoiceGenerationService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<InvoiceGenerationService>());

// SSLCommerz aggregates bKash, Nagad, Rocket and cards behind one merchant account.
// Without credentials the simulated gateway takes over, so a fresh clone still runs
// the full billing flow end to end.
var sslCommerzOptions = builder.Configuration
    .GetSection(SslCommerzOptions.SectionName).Get<SslCommerzOptions>() ?? new SslCommerzOptions();

if (sslCommerzOptions.IsConfigured)
{
    builder.Services.AddHttpClient<IPaymentGateway, SslCommerzPaymentGateway>(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(30);
    });
}
else
{
    builder.Services.AddSingleton<IPaymentGateway, SimulatedPaymentGateway>();
}

// 5. Configure CORS. Deployed environments serve the client from a different origin
// than the API, so the allowed origins come from configuration rather than a constant.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins").Get<string[]>();

if (allowedOrigins is null || allowedOrigins.Length == 0)
{
    allowedOrigins = ["http://localhost:3000"];
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Behind a reverse proxy (App Service, Caddy, nginx) the original scheme and client
// address arrive as headers. Without this the app believes every request is plain
// HTTP from the proxy, which breaks redirect URLs handed to the payment gateway.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // The proxy is the platform's, not ours, so its address is not known ahead of time.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// 6. Controllers
builder.Services.AddControllers();

// 7. Configure Swagger with JWT Bearer support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SafaiTrack API",
        Version = "v1",
        Description = "SafaiTrack Waste Management Backend API"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' [space] and then your valid JWT token.\n\nExample: \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\""
    });

    options.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer"),
            new List<string>()
        }
    });
});

var app = builder.Build();

app.Logger.LogInformation(
    sslCommerzOptions.IsConfigured
        ? "Payments will use the SSLCommerz {Environment} gateway."
        : "No SSLCommerz credentials found — payments will use the simulated gateway.",
    sslCommerzOptions.UseSandbox ? "sandbox" : "live");

app.UseForwardedHeaders();

// Ahead of the endpoints so it can catch serialization failures thrown by the
// Serializable transactions in the dispatch and payment paths.
app.UseMiddleware<SerializationFailureMiddleware>();

// Configure the HTTP request pipeline.
// Swagger stays available in deployed environments too — this is a course project
// whose API is meant to be inspectable. Set "Swagger:Enabled" to false to hide it.
if (builder.Configuration.GetValue("Swagger:Enabled", true))
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapGet("/", () => Results.Redirect("/swagger"));
}
else
{
    app.MapGet("/", () => Results.Ok(new { service = "SafaiTrack API", status = "running" }));
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

// Liveness probe for the hosting platform. Deliberately does not touch the database:
// a database blip should not cause the platform to recycle a healthy app.
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "SafaiTrack API",
    timestamp = DateTime.UtcNow
})).AllowAnonymous();

app.MapControllers();

// Bring the schema up to date, then seed. A freshly provisioned database starts
// empty, and a container-hosted SQL Server is usually still accepting connections
// only after the app has already started, so this retries rather than giving up.
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var context = services.GetRequiredService<ApplicationDbContext>();
    var autoMigrate = builder.Configuration.GetValue("Database:AutoMigrate", true);

    for (var attempt = 1; attempt <= 10; attempt++)
    {
        try
        {
            if (autoMigrate)
            {
                await context.Database.MigrateAsync();
                logger.LogInformation("Database schema is up to date.");
            }
            else if (!await context.Database.CanConnectAsync())
            {
                throw new InvalidOperationException("Database is not reachable.");
            }

            await DbSeeder.SeedAsync(context);
            break;
        }
        catch (Exception ex) when (attempt < 10)
        {
            logger.LogWarning(
                "Database not ready (attempt {Attempt}/10): {Message}. Retrying in 5s.",
                attempt, ex.Message);
            await Task.Delay(TimeSpan.FromSeconds(5));
        }
        catch (Exception ex)
        {
            // Starting without a database is preferable to crash-looping: the health
            // endpoint stays up and the platform's logs show why.
            logger.LogError(ex, "Database could not be prepared. The API is starting anyway.");
        }
    }
}

app.Run();
