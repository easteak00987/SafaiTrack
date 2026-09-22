import pyodbc

conn = pyodbc.connect(
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost\\SQLEXPRESS;'
    'Database=SafaiTrackDb;'
    'Trusted_Connection=yes;'
    'TrustServerCertificate=yes;'
)
c = conn.cursor()
sql = """
SELECT u.Email, u.Role, u.FullName, u.WardId, w.Name as WardName, u.Status
FROM AspNetUsers u
LEFT JOIN Wards w ON u.WardId = w.WardId
ORDER BY u.Role, u.Email
"""
c.execute(sql)
rows = c.fetchall()
conn.close()

admins = [r for r in rows if r[1] == 'Admin']
officers = [r for r in rows if r[1] == 'WardOfficer']
drivers = [r for r in rows if r[1] == 'Driver']
citizens = [r for r in rows if r[1] == 'Citizen']

lines = []
lines.append("# SafaiTrack — Login Credentials Reference")
lines.append("")
lines.append("> **Default password for ALL seeded accounts:** `Password123`")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## Admin Account")
lines.append("")
lines.append("| Email | Password | Role |")
lines.append("|-------|----------|------|")
for r in admins:
    lines.append(f"| `{r[0]}` | `Password123` | Admin |")

lines.append("")
lines.append("---")
lines.append("")
lines.append("## Ward Officers (41 Wards + 4 Backup)")
lines.append("")
lines.append(f"Total: **{len(officers)} Ward Officers**")
lines.append("")
lines.append("| # | Email | Password | Assigned Ward |")
lines.append("|---|-------|----------|---------------|")
for i, r in enumerate(officers, 1):
    ward = f"Ward {r[3]} – {r[4]}" if r[3] else "Unassigned"
    lines.append(f"| {i} | `{r[0]}` | `Password123` | {ward} |")

lines.append("")
lines.append("---")
lines.append("")
lines.append("## Truck Drivers (City-Wide Pool)")
lines.append("")
lines.append(f"Total: **{len(drivers)} Drivers** — All drivers are city-wide (WardId = unassigned),")
lines.append("so any Ward Officer can dispatch any driver to any ward.")
lines.append("")
lines.append("| # | Email | Password | Role |")
lines.append("|---|-------|----------|------|")
for i, r in enumerate(drivers, 1):
    lines.append(f"| {i} | `{r[0]}` | `Password123` | Driver |")

lines.append("")
lines.append("---")
lines.append("")
lines.append("## Citizens")
lines.append("")
lines.append(f"Total: **{len(citizens)} Citizens**")
lines.append("")
lines.append("| # | Email | Password |")
lines.append("|---|-------|----------|")
for i, r in enumerate(citizens, 1):
    lines.append(f"| {i} | `{r[0]}` | `Password123` |")

lines.append("")
lines.append("---")
lines.append("")
lines.append("## Notes")
lines.append("")
lines.append("- All seeded accounts use password: **`Password123`**")
lines.append("- Accounts registered via the website (Ward Officer / Driver) require Admin approval before they can log in.")
lines.append("- Citizens registered via the website can log in immediately.")
lines.append("- Admin account: `admin@safaitrack.local`")
lines.append("")

output = "\n".join(lines)

# Save to D:\SafaiTrack\ for easy access
with open(r"D:\SafaiTrack\CREDENTIALS.md", "w", encoding="utf-8") as f:
    f.write(output)

print(f"Written CREDENTIALS.md")
print(f"  Admins:   {len(admins)}")
print(f"  Officers: {len(officers)}")
print(f"  Drivers:  {len(drivers)}")
print(f"  Citizens: {len(citizens)}")
