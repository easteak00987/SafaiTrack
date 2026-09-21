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

// 1. Configure DbContext dynamically with SQL Server or PostgreSQL
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (!string.IsNullOrEmpty(connectionString))
    {
        if (connectionString.StartsWith("Host=", StringComparison.OrdinalIgnoreCase) ||
            connectionString.Contains("Port=", StringComparison.OrdinalIgnoreCase) ||
            connectionString.Contains("Username=", StringComparison.OrdinalIgnoreCase))
        {
            options.UseNpgsql(connectionString);
        }
        else
        {
            options.UseSqlServer(connectionString);
        }
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
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "Jwt:Key must be configured outside Development. Set it as an environment " +
            "variable or platform secret before starting the API.");
    }

    jwtKey = "SafaiTrack_SuperSecret_Jwt_SigningKey_2026_DevEnvironment_AtLeast32Chars!";
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

// 5. Configure CORS
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

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
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
        Description = "Enter 'Bearer' [space] and then your valid JWT token."
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
app.UseMiddleware<SerializationFailureMiddleware>();

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

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "SafaiTrack API",
    timestamp = DateTime.UtcNow
})).AllowAnonymous();

app.MapControllers();

// Bring the schema up to date and seed
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var context = services.GetRequiredService<ApplicationDbContext>();
    var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

    for (var attempt = 1; attempt <= 10; attempt++)
    {
        try
        {
            if (context.Database.IsNpgsql())
            {
                await context.Database.MigrateAsync();
            }
            else
            {
                await context.Database.EnsureCreatedAsync();
            }

            await DbSeeder.SeedAsync(context, userManager, roleManager);
            logger.LogInformation("Database schema and seeding completed successfully.");
            break;
        }
        catch (Exception ex) when (attempt < 10)
        {
            logger.LogWarning(
                "Database not ready (attempt {Attempt}/10): {Message}. Retrying in 3s.",
                attempt, ex.Message);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database could not be prepared or seeded. API starting anyway.");
        }
    }
}

app.Run();
