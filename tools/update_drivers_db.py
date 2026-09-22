import pyodbc

conn = pyodbc.connect(
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost\\SQLEXPRESS;'
    'Database=SafaiTrackDb;'
    'Trusted_Connection=yes;'
    'TrustServerCertificate=yes;'
)
cur = conn.cursor()

# 1. Update Karim Driver (driver@safaitrack.local) to ensure FullName is exactly 'Karim Driver'
cur.execute("""
    UPDATE AspNetUsers
    SET FullName = 'Karim Driver'
    WHERE Email = 'driver@safaitrack.local'
""")

# 2. Update drivers 1 to 20
for i in range(1, 21):
    old_num = f"{i:02d}"
    new_num = f"{i:03d}"
    old_email = f"driver{old_num}@safaitrack.local"
    new_email = f"driver{new_num}@safaitrack.local"
    new_name = f"Driver {new_num}"
    
    cur.execute("""
        UPDATE AspNetUsers
        SET FullName = ?,
            Email = ?,
            NormalizedEmail = ?,
            UserName = ?,
            NormalizedUserName = ?
        WHERE Email = ? OR Email = ?
    """, (new_name, new_email, new_email.upper(), new_email, new_email.upper(), old_email, new_email))
    print(f"Updated {old_email} -> {new_email} ({new_name})")

conn.commit()

# Verify the updated rows
cur.execute("""
    SELECT Id, FullName, Email, UserName 
    FROM AspNetUsers 
    WHERE Role = 'Driver'
    ORDER BY CASE WHEN Email = 'driver@safaitrack.local' THEN 0 ELSE 1 END, Email
""")
print("\n--- Current Drivers in Database ---")
for r in cur.fetchall():
    print(f"Name: {r[1]:<15} | Email: {r[2]:<28} | UserName: {r[3]}")
