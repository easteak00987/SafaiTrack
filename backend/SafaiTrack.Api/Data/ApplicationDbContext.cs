using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Models;
using Route = SafaiTrack.Api.Models.Route;

namespace SafaiTrack.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Ward> Wards => Set<Ward>();
    public DbSet<Bin> Bins => Set<Bin>();
    public DbSet<Complaint> Complaints => Set<Complaint>();
    public DbSet<Truck> Trucks => Set<Truck>();
    public DbSet<Route> Routes => Set<Route>();
    public DbSet<RouteStop> RouteStops => Set<RouteStop>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Configure Ward
        builder.Entity<Ward>(entity =>
        {
            entity.HasKey(w => w.WardId);
            entity.Property(w => w.Name).IsRequired().HasMaxLength(150);
            entity.Property(w => w.Description).HasMaxLength(500);
        });

        // Configure Bin
        builder.Entity<Bin>(entity =>
        {
            entity.HasKey(b => b.BinId);
            entity.Property(b => b.Name).IsRequired().HasMaxLength(150);
            entity.HasOne(b => b.Ward)
                  .WithMany(w => w.Bins)
                  .HasForeignKey(b => b.WardId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure Complaint
        builder.Entity<Complaint>(entity =>
        {
            entity.HasKey(c => c.ComplaintId);
            entity.Property(c => c.Category).IsRequired().HasMaxLength(100);
            entity.Property(c => c.Description).IsRequired().HasMaxLength(1000);
            entity.Property(c => c.Status).IsRequired().HasMaxLength(50);

            entity.HasOne(c => c.Bin)
                  .WithMany(b => b.Complaints)
                  .HasForeignKey(c => c.BinId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.Citizen)
                  .WithMany()
                  .HasForeignKey(c => c.CitizenId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure Truck
        builder.Entity<Truck>(entity =>
        {
            entity.HasKey(t => t.TruckId);
            entity.Property(t => t.PlateNumber).IsRequired().HasMaxLength(50);
            entity.Property(t => t.Status).IsRequired().HasMaxLength(50);
        });

        // Configure Route
        builder.Entity<Route>(entity =>
        {
            entity.HasKey(r => r.RouteId);
            entity.Property(r => r.Algorithm).IsRequired().HasMaxLength(100);
            entity.Property(r => r.Status).IsRequired().HasMaxLength(50);

            entity.HasOne(r => r.Ward)
                  .WithMany(w => w.Routes)
                  .HasForeignKey(r => r.WardId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.Truck)
                  .WithMany(t => t.Routes)
                  .HasForeignKey(r => r.TruckId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(r => r.Driver)
                  .WithMany()
                  .HasForeignKey(r => r.DriverId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Configure RouteStop
        builder.Entity<RouteStop>(entity =>
        {
            entity.HasKey(rs => rs.RouteStopId);

            entity.HasOne(rs => rs.Route)
                  .WithMany(r => r.RouteStops)
                  .HasForeignKey(rs => rs.RouteId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Avoid multiple cascade paths in SQL Server by using Restrict
            entity.HasOne(rs => rs.Bin)
                  .WithMany(b => b.RouteStops)
                  .HasForeignKey(rs => rs.BinId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
