using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Models;

namespace SafaiTrack.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Only seed if no wards exist yet
        if (await context.Wards.AnyAsync())
        {
            return;
        }

        var dhanmondiWard = new Ward
        {
            Name = "Ward 08 / Dhanmondi",
            Description = "Dhanmondi and surrounding neighborhood waste management ward"
        };

        await context.Wards.AddAsync(dhanmondiWard);
        await context.SaveChangesAsync();

        var bins = new List<Bin>
        {
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Dhanmondi 08",
                Latitude = 23.7461,
                Longitude = 90.3742,
                CurrentFillPercent = 94,
                LastUpdated = DateTime.UtcNow
            },
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Kalabagan 03",
                Latitude = 23.7505,
                Longitude = 90.3808,
                CurrentFillPercent = 61,
                LastUpdated = DateTime.UtcNow
            },
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Lalmatia 06",
                Latitude = 23.7562,
                Longitude = 90.3705,
                CurrentFillPercent = 81,
                LastUpdated = DateTime.UtcNow
            },
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Mohammadpur 11",
                Latitude = 23.7621,
                Longitude = 90.3601,
                CurrentFillPercent = 76,
                LastUpdated = DateTime.UtcNow
            },
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Adabor 02",
                Latitude = 23.7712,
                Longitude = 90.3550,
                CurrentFillPercent = 66,
                LastUpdated = DateTime.UtcNow
            },
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Shankar 05",
                Latitude = 23.7480,
                Longitude = 90.3650,
                CurrentFillPercent = 53,
                LastUpdated = DateTime.UtcNow
            },
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Rayer Bazar 02",
                Latitude = 23.7410,
                Longitude = 90.3630,
                CurrentFillPercent = 48,
                LastUpdated = DateTime.UtcNow
            },
            new()
            {
                WardId = dhanmondiWard.WardId,
                Name = "Sukrabad 04",
                Latitude = 23.7525,
                Longitude = 90.3780,
                CurrentFillPercent = 72,
                LastUpdated = DateTime.UtcNow
            }
        };

        await context.Bins.AddRangeAsync(bins);
        await context.SaveChangesAsync();
    }
}
