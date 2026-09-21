"""
seed_staff_accounts.py
=======================
Seeds:
1. One WardOfficer per ward for all 41 wards (officer.<wardname>@safaitrack.local)
2. A second backup WardOfficer for 4 high-density wards (Dhanmondi, Gulshan, Mirpur, Uttara West)
3. 19 city-wide pool Drivers (driver02@safaitrack.local - driver20@safaitrack.local) with WardId = NULL
All accounts use Password: Password123
"""

import pyodbc
import uuid
import re

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\\SQLEXPRESS;"
    "DATABASE=SafaiTrackDb;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)

def slugify(name: str) -> str:
    # "Ward 01 - Uttara West" -> "uttara_west"
    # "Ward 08 / Dhanmondi" -> "dhanmondi"
    if "-" in name:
        part = name.split("-", 1)[1]
    elif "/" in name:
        part = name.split("/", 1)[1]
    else:
        part = name
    clean = re.sub(r'[^a-zA-Z0-9]+', '_', part.strip()).strip('_').lower()
    return clean

def main():
    conn = pyodbc.connect(CONN_STR)
    cur = conn.cursor()

    # Get roles
    cur.execute("SELECT Name, Id FROM AspNetRoles")
    roles = dict(cur.fetchall())
    officer_role_id = roles['WardOfficer']
    driver_role_id = roles['Driver']

    # Get hash from admin
    cur.execute("SELECT PasswordHash FROM AspNetUsers WHERE Email = 'admin@safaitrack.local'")
    pwd_hash = cur.fetchone()[0]

    # Get all wards
    cur.execute("SELECT WardId, Name FROM Wards ORDER BY WardId")
    wards = cur.fetchall()
    print(f"Loaded {len(wards)} wards from database.")

    # Check existing emails
    cur.execute("SELECT Email FROM AspNetUsers")
    existing_emails = set(r[0].lower() for r in cur.fetchall())

    seeded_officers = []
    seeded_drivers = []

    # 1. Seed One WardOfficer per ward
    for ward_id, ward_name in wards:
        if ward_id == 1:
            slug = "dhanmondi"
            email = "officer08@safaitrack.local" # keep existing
        else:
            slug = slugify(ward_name)
            email = f"officer.{slug}@safaitrack.local"

        if email.lower() in existing_emails:
            print(f"Skipping existing officer: {email}")
            continue

        user_id = str(uuid.uuid4())
        full_name = f"Officer - {ward_name}"
        cur.execute("""
            INSERT INTO AspNetUsers (
                Id, FullName, Role, WardId, UserName, NormalizedUserName, 
                Email, NormalizedEmail, EmailConfirmed, PasswordHash, 
                SecurityStamp, ConcurrencyStamp, PhoneNumberConfirmed, 
                TwoFactorEnabled, LockoutEnabled, AccessFailedCount
            ) VALUES (?, ?, 'WardOfficer', ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, 1, 0)
        """, (user_id, full_name, ward_id, email, email.upper(), email, email.upper(), pwd_hash, str(uuid.uuid4()), str(uuid.uuid4())))
        
        cur.execute("INSERT INTO AspNetUserRoles (UserId, RoleId) VALUES (?, ?)", (user_id, officer_role_id))
        existing_emails.add(email.lower())
        seeded_officers.append((email, full_name, ward_id, ward_name))

    # 2. Seed 4 Backup WardOfficers
    backups = [
        (1, "Ward 08 / Dhanmondi", "officer08.backup@safaitrack.local", "Officer - Dhanmondi Backup"),
        (29, "Ward 10 - Gulshan", "officer.gulshan.backup@safaitrack.local", "Officer - Gulshan Backup"),
        (34, "Ward 15 - Mirpur", "officer.mirpur.backup@safaitrack.local", "Officer - Mirpur Backup"),
        (20, "Ward 01 - Uttara West", "officer.uttara_west.backup@safaitrack.local", "Officer - Uttara West Backup"),
    ]

    for ward_id, ward_name, email, full_name in backups:
        if email.lower() in existing_emails:
            print(f"Skipping existing backup officer: {email}")
            continue

        user_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO AspNetUsers (
                Id, FullName, Role, WardId, UserName, NormalizedUserName, 
                Email, NormalizedEmail, EmailConfirmed, PasswordHash, 
                SecurityStamp, ConcurrencyStamp, PhoneNumberConfirmed, 
                TwoFactorEnabled, LockoutEnabled, AccessFailedCount
            ) VALUES (?, ?, 'WardOfficer', ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, 1, 0)
        """, (user_id, full_name, ward_id, email, email.upper(), email, email.upper(), pwd_hash, str(uuid.uuid4()), str(uuid.uuid4())))
        
        cur.execute("INSERT INTO AspNetUserRoles (UserId, RoleId) VALUES (?, ?)", (user_id, officer_role_id))
        existing_emails.add(email.lower())
        seeded_officers.append((email, full_name, ward_id, f"{ward_name} (Backup)"))

    # 3. Seed 20 Pool Drivers (driver001 to driver020)
    for i in range(1, 21):
        num_str = f"{i:03d}"
        email = f"driver{num_str}@safaitrack.local"
        if email.lower() in existing_emails:
            print(f"Skipping existing driver: {email}")
            continue

        user_id = str(uuid.uuid4())
        full_name = f"Driver {num_str}"
        cur.execute("""
            INSERT INTO AspNetUsers (
                Id, FullName, Role, WardId, UserName, NormalizedUserName, 
                Email, NormalizedEmail, EmailConfirmed, PasswordHash, 
                SecurityStamp, ConcurrencyStamp, PhoneNumberConfirmed, 
                TwoFactorEnabled, LockoutEnabled, AccessFailedCount
            ) VALUES (?, ?, 'Driver', NULL, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, 1, 0)
        """, (user_id, full_name, email, email.upper(), email, email.upper(), pwd_hash, str(uuid.uuid4()), str(uuid.uuid4())))
        
        cur.execute("INSERT INTO AspNetUserRoles (UserId, RoleId) VALUES (?, ?)", (user_id, driver_role_id))
        existing_emails.add(email.lower())
        seeded_drivers.append((email, full_name, "None (Pool)"))

    conn.commit()
    print(f"\nSuccessfully seeded {len(seeded_officers)} Ward Officers and {len(seeded_drivers)} Pool Drivers.")

if __name__ == "__main__":
    main()
