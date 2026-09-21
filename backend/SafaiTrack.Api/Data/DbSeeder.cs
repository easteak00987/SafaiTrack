using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SafaiTrack.Api.Models;
using Route = SafaiTrack.Api.Models.Route;

namespace SafaiTrack.Api.Data;


public static class DbSeeder
{
    private record WardDefinition(string Name, double Lat, double Lon, string Description);
    private record DriverDefinition(string Email, string FullName, string Gender, string Phone);
    private record OfficerDefinition(string Email, string FullName, string Gender, string Phone, string WardKeyword, bool IsBackup = false);
    private record CitizenDefinition(string Email, string FullName, string Gender, string Phone, string WardKeyword);

    public static async Task SeedAsync(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager)
    {
        // 1. Roles
        string[] roles = { "Admin", "WardOfficer", "Driver", "Citizen" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        // 2. Wards
        var wardDefinitions = new List<WardDefinition>
        {
            new("Ward 08 / Dhanmondi", 23.7461, 90.3742, "Dhanmondi and surrounding neighborhood waste management ward"),
            new("Ward 01 - Uttara West", 23.8741, 90.3758, "Uttara Model Town, Sector 1-6"),
            new("Ward 02 - Uttara East", 23.8765, 90.4050, "Uttara Sector 7-14"),
            new("Ward 03 - Uttara Centre", 23.8610, 90.3900, "Uttara Sector 3-4"),
            new("Ward 04 - Turag", 23.8950, 90.3630, "Turag, Diabari"),
            new("Ward 05 - Khilkhet", 23.8325, 90.4272, "Khilkhet, Nikunja"),
            new("Ward 06 - Dakshin Khan", 23.8572, 90.4440, "Dakshin Khan"),
            new("Ward 07 - Uttar Khan", 23.8750, 90.4480, "Uttar Khan"),
            new("Ward 08 - Vatara", 23.8163, 90.4355, "Vatara, Baridhara DOHS"),
            new("Ward 09 - Badda", 23.7887, 90.4300, "Badda, Shahjadpur"),
            new("Ward 10 - Gulshan", 23.7925, 90.4152, "Gulshan 1 & 2"),
            new("Ward 11 - Banani", 23.7935, 90.4038, "Banani, Mohakhali"),
            new("Ward 12 - Cantonment", 23.8065, 90.4015, "Dhaka Cantonment"),
            new("Ward 13 - Pallabi", 23.8283, 90.3680, "Pallabi, Mirpur 11-12"),
            new("Ward 14 - Kafrul", 23.8005, 90.3738, "Kafrul, Taltola"),
            new("Ward 15 - Mirpur", 23.8092, 90.3590, "Mirpur 1-2"),
            new("Ward 16 - Shewrapara", 23.8017, 90.3600, "Shewrapara, Mirpur 10"),
            new("Ward 17 - Rayer Bazar", 23.7605, 90.3605, "Rayer Bazar, Shaymoli"),
            new("Ward 18 - Dhanmondi", 23.7461, 90.3742, "Dhanmondi Residential Area"),
            new("Ward 19 - Kalabagan", 23.7505, 90.3808, "Kalabagan, Panthapath"),
            new("Ward 20 - Hazaribagh", 23.7247, 90.3683, "Hazaribagh, Jigatola"),
            new("Ward 21 - Lalbagh", 23.7200, 90.3831, "Lalbagh Fort area"),
            new("Ward 22 - Kamrangirchar", 23.7100, 90.3702, "Kamrangirchar"),
            new("Ward 23 - Kotwali", 23.7185, 90.4068, "Kotwali, Farashganj"),
            new("Ward 24 - Sutrapur", 23.7262, 90.4148, "Sutrapur, Wari"),
            new("Ward 25 - Gandaria", 23.7162, 90.4202, "Gandaria, Dhupkhola"),
            new("Ward 26 - Jatrabari", 23.7072, 90.4300, "Jatrabari"),
            new("Ward 27 - Demra", 23.7000, 90.4530, "Demra"),
            new("Ward 28 - Shyampur", 23.7080, 90.4430, "Shyampur"),
            new("Ward 29 - Kadamtali", 23.7150, 90.4380, "Kadamtali"),
            new("Ward 30 - Sabujbagh", 23.7350, 90.4340, "Sabujbagh, Basabo"),
            new("Ward 31 - Khilgaon", 23.7440, 90.4280, "Khilgaon"),
            new("Ward 32 - Rampura", 23.7660, 90.4210, "Rampura, Banasree"),
            new("Ward 33 - Mugda", 23.7370, 90.4250, "Mugda, Manda"),
            new("Ward 34 - Hatirjheel", 23.7620, 90.4050, "Hatirjheel, Navana"),
            new("Ward 35 - Tejgaon", 23.7600, 90.3940, "Tejgaon Industrial Area"),
            new("Ward 36 - Farmgate", 23.7575, 90.3870, "Farmgate, Green Road"),
            new("Ward 37 - Sher-e-Bangla Nagar", 23.7650, 90.3680, "Sher-e-Bangla Nagar, Agargaon"),
            new("Ward 38 - Mohammadpur", 23.7625, 90.3605, "Mohammadpur, Nurjahan Road"),
            new("Ward 39 - Adabor", 23.7712, 90.3550, "Adabor, Shaymoli"),
            new("Ward 40 - Lalmatia", 23.7562, 90.3705, "Lalmatia")
        };

        var existingWards = await context.Wards.ToListAsync();
        var wardMap = existingWards.ToDictionary(w => w.Name, StringComparer.OrdinalIgnoreCase);

        foreach (var def in wardDefinitions)
        {
            if (!wardMap.TryGetValue(def.Name, out var ward))
            {
                ward = new Ward
                {
                    Name = def.Name,
                    Description = def.Description
                };
                await context.Wards.AddAsync(ward);
                await context.SaveChangesAsync();
                wardMap[ward.Name] = ward;
            }

            // Ensure bins exist for this ward
            var hasBins = await context.Bins.AnyAsync(b => b.WardId == ward.WardId);
            if (!hasBins)
            {
                var (lat, lon) = (def.Lat, def.Lon);
                var offsets = new (double dLat, double dLon, string tag, int fill)[]
                {
                    (0.002, 0.003, "Market", 82),
                    (-0.003, 0.002, "Roadside", 64),
                    (0.001, -0.004, "Residential", 45),
                    (-0.002, -0.002, "Commercial", 91),
                    (0.004, 0.001, "Community", 53),
                    (-0.001, 0.003, "Bus Stop", 76)
                };

                var wardShortName = def.Name.Contains('-') ? def.Name.Split('-')[1].Trim() : def.Name;
                if (wardShortName.Contains('/')) wardShortName = wardShortName.Split('/')[1].Trim();

                var bins = offsets.Select((o, i) => new Bin
                {
                    WardId = ward.WardId,
                    Name = $"{wardShortName} {o.tag} Bin {i + 1:02d}",
                    Latitude = lat + o.dLat,
                    Longitude = lon + o.dLon,
                    CurrentFillPercent = o.fill,
                    LastUpdated = DateTime.UtcNow
                }).ToList();

                await context.Bins.AddRangeAsync(bins);
                await context.SaveChangesAsync();
            }
        }

        // Refresh wardMap after inserts
        var allWards = await context.Wards.ToListAsync();

        // 3. Collection Trucks (30 fleet units)
        if (!await context.Trucks.AnyAsync())
        {
            var zones = new[] { "TA", "MH", "GS", "MI", "UT", "KA", "MO", "LA", "BA", "DR" };
            var trucks = new List<Truck>();
            var num = 101;
            foreach (var zone in zones)
            {
                for (int i = 0; i < 3; i++)
                {
                    trucks.Add(new Truck
                    {
                        PlateNumber = $"DHK-{zone}-{num:03d}",
                        Status = "Available"
                    });
                    num++;
                }
            }
            await context.Trucks.AddRangeAsync(trucks);
            await context.SaveChangesAsync();
        }

        // Helper to find ward by keyword
        Ward? FindWardByKeyword(string keyword)
        {
            return allWards.FirstOrDefault(w => w.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        // 4. Admin Account
        var adminEmail = "admin@safaitrack.local";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser == null)
        {
            adminUser = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                FullName = "Khandakar Admin",
                Gender = "Male",
                PhoneNumber = "+8801991000001",
                Role = "Admin",
                Status = "Active",
                EmailConfirmed = true
            };
            await userManager.CreateAsync(adminUser, "Password123");
            await userManager.AddToRoleAsync(adminUser, "Admin");
        }
        else
        {
            adminUser.FullName = "Khandakar Admin";
            adminUser.Gender = "Male";
            adminUser.PhoneNumber = "+8801991000001";
            adminUser.Role = "Admin";
            adminUser.Status = "Active";
            await userManager.UpdateAsync(adminUser);
        }

        // 5. 21 Drivers (Exact requested Bangladeshi names & unique phones)
        var drivers = new List<DriverDefinition>
        {
            new("driver@safaitrack.local", "Karim Driver", "Male", "+8801711000101"),
            new("driver001@safaitrack.local", "Jasim Uddin", "Male", "+8801711000102"),
            new("driver002@safaitrack.local", "Nazrul Islam", "Male", "+8801711000103"),
            new("driver003@safaitrack.local", "Abul Kalam", "Male", "+8801711000104"),
            new("driver004@safaitrack.local", "Habibur Rahman", "Male", "+8801711000105"),
            new("driver005@safaitrack.local", "Shahjahan Mia", "Male", "+8801711000106"),
            new("driver006@safaitrack.local", "Delwar Hossain", "Male", "+8801711000107"),
            new("driver007@safaitrack.local", "Mizanur Rahman", "Male", "+8801711000108"),
            new("driver008@safaitrack.local", "Nurul Amin", "Male", "+8801711000109"),
            new("driver009@safaitrack.local", "Aminul Islam", "Male", "+8801711000110"),
            new("driver010@safaitrack.local", "Rafiqul Islam", "Male", "+8801711000111"),
            new("driver011@safaitrack.local", "Shamsul Haque", "Male", "+8801711000112"),
            new("driver012@safaitrack.local", "Kamal Uddin", "Male", "+8801711000113"),
            new("driver013@safaitrack.local", "Golam Mostofa", "Male", "+8801711000114"),
            new("driver014@safaitrack.local", "Anwar Hossain", "Male", "+8801711000115"),
            new("driver015@safaitrack.local", "Faruk Ahmed", "Male", "+8801711000116"),
            new("driver016@safaitrack.local", "Shafiqul Alam", "Male", "+8801711000117"),
            new("driver017@safaitrack.local", "Mokbul Hossain", "Male", "+8801711000118"),
            new("driver018@safaitrack.local", "Abdur Razzak", "Male", "+8801711000119"),
            new("driver019@safaitrack.local", "Liakot Ali", "Male", "+8801711000120"),
            new("driver020@safaitrack.local", "Selim Reza", "Male", "+8801711000121")
        };

        foreach (var d in drivers)
        {
            var user = await userManager.FindByEmailAsync(d.Email);
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = d.Email,
                    Email = d.Email,
                    FullName = d.FullName,
                    Gender = d.Gender,
                    PhoneNumber = d.Phone,
                    Role = "Driver",
                    Status = "Active",
                    WardId = null, // city-wide driver pool
                    EmailConfirmed = true
                };
                await userManager.CreateAsync(user, "Password123");
                await userManager.AddToRoleAsync(user, "Driver");
            }
            else
            {
                user.FullName = d.FullName;
                user.Gender = d.Gender;
                user.PhoneNumber = d.Phone;
                user.Role = "Driver";
                user.Status = "Active";
                await userManager.UpdateAsync(user);
            }
        }

        // 6. 45 Ward Officers (Distinct Bangladeshi names and ward assignments)
        var officers = new List<OfficerDefinition>
        {
            new("officer.adabor@safaitrack.local", "Farida Yasmin", "Female", "+8801812000201", "Adabor"),
            new("officer.badda@safaitrack.local", "Mahbub Alam", "Male", "+8801812000202", "Badda"),
            new("officer.banani@safaitrack.local", "Shirin Akter", "Female", "+8801812000203", "Banani"),
            new("officer.cantonment@safaitrack.local", "Ruhul Kabir", "Male", "+8801812000204", "Cantonment"),
            new("officer.dakshin_khan@safaitrack.local", "Nasrin Begum", "Female", "+8801812000205", "Dakshin Khan"),
            new("officer.demra@safaitrack.local", "Zillur Rahman", "Male", "+8801812000206", "Demra"),
            new("officer.dhanmondi@safaitrack.local", "Sabina Yeasmin", "Female", "+8801812000207", "Ward 18 - Dhanmondi"),
            new("officer.farmgate@safaitrack.local", "Enamul Haque", "Male", "+8801812000208", "Farmgate"),
            new("officer.gandaria@safaitrack.local", "Rokeya Sultana", "Female", "+8801812000209", "Gandaria"),
            new("officer.gulshan.backup@safaitrack.local", "Anisur Rahman", "Male", "+8801812000210", "Gulshan", true),
            new("officer.gulshan@safaitrack.local", "Tahmina Chowdhury", "Female", "+8801812000211", "Gulshan"),
            new("officer.hatirjheel@safaitrack.local", "Monirul Islam", "Male", "+8801812000212", "Hatirjheel"),
            new("officer.hazaribagh@safaitrack.local", "Kamrun Nahar", "Female", "+8801812000213", "Hazaribagh"),
            new("officer.jatrabari@safaitrack.local", "Kazi Mostaq Ahmed", "Male", "+8801812000214", "Jatrabari"),
            new("officer.kadamtali@safaitrack.local", "Shahana Parvin", "Female", "+8801812000215", "Kadamtali"),
            new("officer.kafrul@safaitrack.local", "Golam Sarwar", "Male", "+8801812000216", "Kafrul"),
            new("officer.kalabagan@safaitrack.local", "Rasheda Khanam", "Female", "+8801812000217", "Kalabagan"),
            new("officer.kamrangirchar@safaitrack.local", "Jahangir Hossain", "Male", "+8801812000218", "Kamrangirchar"),
            new("officer.khilgaon@safaitrack.local", "Laila Arjumand", "Female", "+8801812000219", "Khilgaon"),
            new("officer.khilkhet@safaitrack.local", "Moshiur Rahman", "Male", "+8801812000220", "Khilkhet"),
            new("officer.kotwali@safaitrack.local", "Rehana Akhter", "Female", "+8801812000221", "Kotwali"),
            new("officer.lalbagh@safaitrack.local", "Fazlul Karim", "Male", "+8801812000222", "Lalbagh"),
            new("officer.lalmatia@safaitrack.local", "Sultana Razia", "Female", "+8801812000223", "Ward 40 - Lalmatia"),
            new("officer.mirpur.backup@safaitrack.local", "Asaduzzaman Nur", "Male", "+8801812000224", "Mirpur", true),
            new("officer.mirpur@safaitrack.local", "Ferdousi Begum", "Female", "+8801812000225", "Mirpur"),
            new("officer.mohammadpur@safaitrack.local", "Saiful Islam", "Male", "+8801812000226", "Mohammadpur"),
            new("officer.mugda@safaitrack.local", "Khaleda Akter", "Female", "+8801812000227", "Mugda"),
            new("officer.pallabi@safaitrack.local", "Mustafizur Rahman", "Male", "+8801812000228", "Pallabi"),
            new("officer.rampura@safaitrack.local", "Nusrat Parveen", "Female", "+8801812000229", "Rampura"),
            new("officer.rayer_bazar@safaitrack.local", "Ashraf Ali", "Male", "+8801812000230", "Rayer Bazar"),
            new("officer.sabujbagh@safaitrack.local", "Jesmin Ara", "Female", "+8801812000231", "Sabujbagh"),
            new("officer.sher_e_bangla_nagar@safaitrack.local", "Shahidul Haque", "Male", "+8801812000232", "Sher-e-Bangla Nagar"),
            new("officer.shewrapara@safaitrack.local", "Bilkiss Banu", "Female", "+8801812000233", "Shewrapara"),
            new("officer.shyampur@safaitrack.local", "Sirajul Islam", "Male", "+8801812000234", "Shyampur"),
            new("officer.sutrapur@safaitrack.local", "Salma Khatun", "Female", "+8801812000235", "Sutrapur"),
            new("officer.tejgaon@safaitrack.local", "Abdur Rahim Mia", "Male", "+8801812000236", "Tejgaon"),
            new("officer.turag@safaitrack.local", "Nazma Begum", "Female", "+8801812000237", "Turag"),
            new("officer.uttar_khan@safaitrack.local", "Kabir Hossain", "Male", "+8801812000238", "Uttar Khan"),
            new("officer.uttara_centre@safaitrack.local", "Afroza Parvin", "Female", "+8801812000239", "Uttara Centre"),
            new("officer.uttara_east@safaitrack.local", "Zakir Hossain", "Male", "+8801812000240", "Uttara East"),
            new("officer.uttara_west.backup@safaitrack.local", "Meherun Nesa", "Female", "+8801812000241", "Uttara West", true),
            new("officer.uttara_west@safaitrack.local", "Tanvir Mahmud", "Male", "+8801812000242", "Uttara West"),
            new("officer.vatara@safaitrack.local", "Shamima Nasrin", "Female", "+8801812000243", "Vatara"),
            new("officer08.backup@safaitrack.local", "Sayedul Hoque", "Male", "+8801812000244", "Ward 08 / Dhanmondi", true),
            new("officer08@safaitrack.local", "Tariq Officer", "Male", "+8801812000245", "Ward 08 / Dhanmondi")
        };

        foreach (var o in officers)
        {
            var assignedWard = FindWardByKeyword(o.WardKeyword);
            var user = await userManager.FindByEmailAsync(o.Email);
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = o.Email,
                    Email = o.Email,
                    FullName = o.FullName,
                    Gender = o.Gender,
                    PhoneNumber = o.Phone,
                    Role = "WardOfficer",
                    Status = "Active",
                    WardId = assignedWard?.WardId,
                    EmailConfirmed = true
                };
                await userManager.CreateAsync(user, "Password123");
                await userManager.AddToRoleAsync(user, "WardOfficer");
            }
            else
            {
                user.FullName = o.FullName;
                user.Gender = o.Gender;
                user.PhoneNumber = o.Phone;
                user.Role = "WardOfficer";
                user.Status = "Active";
                if (user.WardId == null && assignedWard != null)
                {
                    user.WardId = assignedWard.WardId;
                }
                await userManager.UpdateAsync(user);
            }
        }

        // 7. Citizens
        var citizens = new List<CitizenDefinition>
        {
            new("citizen@safaitrack.local", "Tanvir Hossain", "Male", "+8801991000101", "Dhanmondi"),
            new("citizen01@safaitrack.local", "Nusrat Jahan", "Female", "+8801991000102", "Gulshan"),
            new("citizen02@safaitrack.local", "Sadia Afrin", "Female", "+8801991000103", "Mirpur"),
            new("easteak00987@gmail.com", "Easteak Ahmed", "Male", "+8801991000166", "Dhanmondi")
        };

        foreach (var c in citizens)
        {
            var assignedWard = FindWardByKeyword(c.WardKeyword);
            var user = await userManager.FindByEmailAsync(c.Email);
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = c.Email,
                    Email = c.Email,
                    FullName = c.FullName,
                    Gender = c.Gender,
                    PhoneNumber = c.Phone,
                    Role = "Citizen",
                    Status = "Active",
                    WardId = assignedWard?.WardId,
                    EmailConfirmed = true
                };
                await userManager.CreateAsync(user, "Password123");
                await userManager.AddToRoleAsync(user, "Citizen");
            }
            else
            {
                user.FullName = c.FullName;
                user.Gender = c.Gender;
                user.PhoneNumber = c.Phone;
                user.Role = "Citizen";
                user.Status = "Active";
                if (user.WardId == null && assignedWard != null)
                {
                    user.WardId = assignedWard.WardId;
                }
                await userManager.UpdateAsync(user);
            }
        }

        // Ensure EVERY active citizen has an assigned valid ward randomly selected from available wards
        var allWardsList = await context.Wards.ToListAsync();
        if (allWardsList.Any())
        {
            var allActiveCitizens = await context.Users.Where(u => u.Role == "Citizen" && u.Status == "Active").ToListAsync();
            var rnd = new Random(42);
            foreach (var cUser in allActiveCitizens)
            {
                if (cUser.WardId == null || cUser.WardId == 0)
                {
                    cUser.WardId = allWardsList[rnd.Next(allWardsList.Count)].WardId;
                    await userManager.UpdateAsync(cUser);
                }
            }
        }

        // 8. New Pending Approval Accounts for Admin Approvals Testing
        var pendingAccounts = new[]
        {
            new { Email = "mahir.citizen@safaitrack.local", FullName = "Mahir Faysal", Gender = "Male", Phone = "+8801912345001", Role = "Citizen", Ward = "Dhanmondi" },
            new { Email = "rafiq.driver@safaitrack.local", FullName = "Rafiqul Islam Babul", Gender = "Male", Phone = "+8801712345002", Role = "Driver", Ward = "" },
            new { Email = "nusrat.officer@safaitrack.local", FullName = "Nusrat Jahan Chowdhury", Gender = "Female", Phone = "+8801812345003", Role = "WardOfficer", Ward = "Dhanmondi" }
        };

        foreach (var p in pendingAccounts)
        {
            var user = await userManager.FindByEmailAsync(p.Email);
            var assignedWard = !string.IsNullOrEmpty(p.Ward) ? FindWardByKeyword(p.Ward) : null;
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = p.Email,
                    Email = p.Email,
                    FullName = p.FullName,
                    Gender = p.Gender,
                    PhoneNumber = p.Phone,
                    Role = p.Role,
                    Status = "PendingApproval",
                    WardId = null,
                    RequestedWardId = (p.Role == "Citizen" || p.Role == "WardOfficer") ? assignedWard?.WardId : null,
                    EmailConfirmed = false
                };
                await userManager.CreateAsync(user, "Pass1234!");
                await userManager.AddToRoleAsync(user, p.Role);
            }
            else
            {
                if (p.Role == "Citizen")
                {
                    user.RequestedWardId = assignedWard?.WardId;
                    user.WardId = null;
                    user.Status = "PendingApproval";
                    await userManager.UpdateAsync(user);
                }
            }
        }

        // 9. Operational Activity: Complaints & Resolutions for ALL Ward Officers
        var activeOfficers = await context.Users.Where(u => u.Role == "WardOfficer" && u.Status == "Active").ToListAsync();
        var allBins = await context.Bins.ToListAsync();
        var citizensList = await context.Users.Where(u => u.Role == "Citizen" && u.Status == "Active").ToListAsync();
        var primaryCitizen = citizensList.FirstOrDefault();

        if (primaryCitizen != null && allBins.Any())
        {
            var now = DateTime.UtcNow;
            foreach (var off in activeOfficers)
            {
                var wardBins = allBins.Where(b => b.WardId == off.WardId).ToList();
                if (!wardBins.Any()) continue;

                var hasComplaints = await context.Complaints.AnyAsync(c => c.Bin!.WardId == off.WardId);
                if (!hasComplaints)
                {
                    var b1 = wardBins[0];
                    var b2 = wardBins.Count > 1 ? wardBins[1] : wardBins[0];

                    var comp1 = new Complaint
                    {
                        BinId = b1.BinId,
                        CitizenId = primaryCitizen.Id,
                        Category = "Overflowing",
                        Description = "Excess waste accumulating after peak morning hours; requires clearing.",
                        Status = "Resolved",
                        CreatedAt = now.AddHours(-10),
                        ResolvedAt = now.AddHours(-2)
                    };
                    context.Complaints.Add(comp1);

                    var comp2 = new Complaint
                    {
                        BinId = b2.BinId,
                        CitizenId = primaryCitizen.Id,
                        Category = "Odor / Hazard",
                        Description = "Unpleasant odor near neighborhood path; sanitization requested.",
                        Status = "InProgress",
                        CreatedAt = now.AddHours(-4)
                    };
                    context.Complaints.Add(comp2);
                    await context.SaveChangesAsync();

                    context.ComplaintUpdates.Add(new ComplaintUpdate
                    {
                        ComplaintId = comp1.ComplaintId,
                        AuthorId = off.Id,
                        AuthorName = off.FullName,
                        Status = "Resolved",
                        Message = "Collection completed and bin surroundings disinfected.",
                        CreatedAt = now.AddHours(-2)
                    });

                    context.ComplaintUpdates.Add(new ComplaintUpdate
                    {
                        ComplaintId = comp2.ComplaintId,
                        AuthorId = off.Id,
                        AuthorName = off.FullName,
                        Status = "InProgress",
                        Message = "Inspection ongoing; crew dispatched.",
                        CreatedAt = now.AddHours(-3)
                    });
                }
            }
            await context.SaveChangesAsync();
        }

        // 10. Operational Activity: Routes, RouteActivities & Driver Daily Quotas for ALL Drivers
        var activeDrivers = await context.Users.Where(u => u.Role == "Driver" && u.Status == "Active").ToListAsync();
        var availableTrucks = await context.Trucks.ToListAsync();

        if (activeDrivers.Any() && availableTrucks.Any())
        {
            var now = DateTime.UtcNow;
            for (int i = 0; i < activeDrivers.Count; i++)
            {
                var driver = activeDrivers[i];
                var truck = availableTrucks[i % availableTrucks.Count];
                var assignedOfficer = activeOfficers[i % activeOfficers.Count];
                var wardId = assignedOfficer.WardId ?? 1;
                var wardBins = allBins.Where(b => b.WardId == wardId).Take(8).ToList();

                var hasCompleted = await context.Routes.AnyAsync(r => r.DriverId == driver.Id && r.Status == "Completed");
                if (!hasCompleted && wardBins.Count >= 2)
                {
                    var completedRoute = new Route
                    {
                        WardId = wardId,
                        DriverId = driver.Id,
                        TruckId = truck.TruckId,
                        Status = "Completed",
                        Algorithm = "dijkstra",
                        TotalDistanceKm = 4.8,
                        NaiveDistanceKm = 7.2,
                        CreatedAt = now.AddHours(-6),
                        CompletedAt = now.AddHours(-3),
                        RouteStops = wardBins.Select((b, seq) => new RouteStop
                        {
                            BinId = b.BinId,
                            StopSequence = seq + 1,
                            CollectedAt = now.AddHours(-3)
                        }).ToList()
                    };
                    context.Routes.Add(completedRoute);
                    await context.SaveChangesAsync();

                    context.RouteActivities.Add(new RouteActivity
                    {
                        RouteId = completedRoute.RouteId,
                        ActorId = assignedOfficer.Id,
                        Action = "Assigned",
                        CreatedAt = now.AddHours(-6)
                    });
                    context.RouteActivities.Add(new RouteActivity
                    {
                        RouteId = completedRoute.RouteId,
                        ActorId = assignedOfficer.Id,
                        Action = "Optimized",
                        CreatedAt = now.AddHours(-6)
                    });

                    var binsCount = wardBins.Count;
                    var baseAmt = 800m;
                    var perBin = 50m;
                    var subtotal = baseAmt + (binsCount * perBin);
                    var bonus = binsCount >= 6 ? decimal.Round(subtotal * 0.20m, 2) : 0m;
                    var total = subtotal + bonus;

                    string wageStatus = (i % 3 == 0) ? "Released" : (i % 3 == 1) ? "Collected" : "Accruing";

                    var wage = new DriverWage
                    {
                        DriverId = driver.Id,
                        PeriodStart = now.AddHours(-26),
                        PeriodEnd = now.AddHours(-2),
                        RoutesCompleted = 1,
                        BinsCollected = binsCount,
                        RequiredRoutes = 1,
                        RequiredBins = 6,
                        BaseAmount = baseAmt,
                        PerBinAmount = perBin,
                        BonusRate = 0.20m,
                        BonusAmount = bonus,
                        Amount = total,
                        Status = wageStatus,
                        ReleasedAt = wageStatus != "Accruing" ? now.AddHours(-1) : null,
                        ReleasedById = wageStatus != "Accruing" ? "admin" : null,
                        CollectedAt = wageStatus == "Collected" ? now.AddMinutes(-30) : null,
                        Contributions = new List<WageContribution>
                        {
                            new WageContribution
                            {
                                RouteId = completedRoute.RouteId,
                                BinsCollected = binsCount,
                                CompletedAt = now.AddHours(-3)
                            }
                        }
                    };
                    context.DriverWages.Add(wage);
                }
            }
            await context.SaveChangesAsync();
        }

        // 11. Billing Proposals (BillingDrafts) ready to send in Admin Dashboard
        var unbilledCitizens = await context.Users.Where(u => u.Role == "Citizen" && u.Status == "Active" && u.WardId != null).ToListAsync();
        var nextPeriod = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);

        foreach (var cit in unbilledCitizens)
        {
            var hasDraft = await context.BillingDrafts.AnyAsync(d => d.CitizenId == cit.Id && d.PeriodStart == nextPeriod);
            if (!hasDraft)
            {
                context.BillingDrafts.Add(new BillingDraft
                {
                    CitizenId = cit.Id,
                    WardId = cit.WardId!.Value,
                    PeriodStart = nextPeriod,
                    Amount = 150m,
                    Currency = "BDT",
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        await context.SaveChangesAsync();
    }
}

