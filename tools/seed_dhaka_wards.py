"""
seed_dhaka_wards.py
====================
Fetches all Dhaka North City Corporation (DNCC) wards from the
Overpass API (OpenStreetMap) and seeds them into the SafaiTrack
SQL Server database, along with representative waste-collection
bin locations from OSM amenity=waste_basket / waste_disposal nodes.

Usage:
    python seed_dhaka_wards.py [--dry-run]

Requirements:
    pip install requests pyodbc

Rate-limit policy (OSM Acceptable Use):
  - User-Agent identifies this as a student project
  - Minimum 1.5 s between each Overpass request
  - No parallel requests
"""

import argparse
import sys
import time
import json
import random
import math
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    sys.exit("Missing 'requests'. Run: pip install requests")

try:
    import pyodbc
except ImportError:
    sys.exit("Missing 'pyodbc'. Run: pip install pyodbc")

# ── Configuration ────────────────────────────────────────────────────────────

CONNECTION_STRING = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\\SQLEXPRESS;"
    "DATABASE=SafaiTrackDb;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = (
    "SafaiTrack-StudentProject/1.0 "
    "(Academic project, Dhaka ward seeding; "
    "github.com/easteak00987/SafaiTrack)"
)
REQUEST_DELAY = 1.6   # seconds between Overpass calls (> 1 s as required)

# Dhaka North City Corporation OSM relation ID
# (DNCC covers wards 1-54 roughly; we fetch by admin_level boundary)
DHAKA_DNCC_RELATION = 7447063   # DNCC administrative boundary

# Fallback: if Overpass returns no named wards, we use a curated list of
# well-known DNCC ward centroids so the seed is never empty.
FALLBACK_WARDS = [
    ("Ward 01 - Uttara West",       23.8741, 90.3758, "Uttara Model Town, Sector 1-6"),
    ("Ward 02 - Uttara East",       23.8765, 90.4050, "Uttara Sector 7-14"),
    ("Ward 03 - Uttara Centre",     23.8610, 90.3900, "Uttara Sector 3-4"),
    ("Ward 04 - Turag",             23.8950, 90.3630, "Turag, Diabari"),
    ("Ward 05 - Khilkhet",          23.8325, 90.4272, "Khilkhet, Nikunja"),
    ("Ward 06 - Dakshin Khan",      23.8572, 90.4440, "Dakshin Khan"),
    ("Ward 07 - Uttar Khan",        23.8750, 90.4480, "Uttar Khan"),
    ("Ward 08 - Vatara",            23.8163, 90.4355, "Vatara, Baridhara DOHS"),
    ("Ward 09 - Badda",             23.7887, 90.4300, "Badda, Shahjadpur"),
    ("Ward 10 - Gulshan",           23.7925, 90.4152, "Gulshan 1 & 2"),
    ("Ward 11 - Banani",            23.7935, 90.4038, "Banani, Mohakhali"),
    ("Ward 12 - Cantonment",        23.8065, 90.4015, "Dhaka Cantonment"),
    ("Ward 13 - Pallabi",           23.8283, 90.3680, "Pallabi, Mirpur 11-12"),
    ("Ward 14 - Kafrul",            23.8005, 90.3738, "Kafrul, Taltola"),
    ("Ward 15 - Mirpur",            23.8092, 90.3590, "Mirpur 1-2"),
    ("Ward 16 - Shewrapara",        23.8017, 90.3600, "Shewrapara, Mirpur 10"),
    ("Ward 17 - Rayer Bazar",       23.7605, 90.3605, "Rayer Bazar, Shaymoli"),
    ("Ward 18 - Dhanmondi",         23.7461, 90.3742, "Dhanmondi Residential Area"),
    ("Ward 19 - Kalabagan",         23.7505, 90.3808, "Kalabagan, Panthapath"),
    ("Ward 20 - Hazaribagh",        23.7247, 90.3683, "Hazaribagh, Jigatola"),
    ("Ward 21 - Lalbagh",           23.7200, 90.3831, "Lalbagh Fort area"),
    ("Ward 22 - Kamrangirchar",     23.7100, 90.3702, "Kamrangirchar"),
    ("Ward 23 - Kotwali",           23.7185, 90.4068, "Kotwali, Farashganj"),
    ("Ward 24 - Sutrapur",          23.7262, 90.4148, "Sutrapur, Wari"),
    ("Ward 25 - Gandaria",          23.7162, 90.4202, "Gandaria, Dhupkhola"),
    ("Ward 26 - Jatrabari",         23.7072, 90.4300, "Jatrabari"),
    ("Ward 27 - Demra",             23.7000, 90.4530, "Demra"),
    ("Ward 28 - Shyampur",          23.7080, 90.4430, "Shyampur"),
    ("Ward 29 - Kadamtali",         23.7150, 90.4380, "Kadamtali"),
    ("Ward 30 - Sabujbagh",         23.7350, 90.4340, "Sabujbagh, Basabo"),
    ("Ward 31 - Khilgaon",          23.7440, 90.4280, "Khilgaon"),
    ("Ward 32 - Rampura",           23.7660, 90.4210, "Rampura, Banasree"),
    ("Ward 33 - Mugda",             23.7370, 90.4250, "Mugda, Manda"),
    ("Ward 34 - Hatirjheel",        23.7620, 90.4050, "Hatirjheel, Navana"),
    ("Ward 35 - Tejgaon",           23.7600, 90.3940, "Tejgaon Industrial Area"),
    ("Ward 36 - Farmgate",          23.7575, 90.3870, "Farmgate, Green Road"),
    ("Ward 37 - Sher-e-Bangla Nagar",23.7650,90.3680, "Sher-e-Bangla Nagar, Agargaon"),
    ("Ward 38 - Mohammadpur",       23.7625, 90.3605, "Mohammadpur, Nurjahan Road"),
    ("Ward 39 - Adabor",            23.7712, 90.3550, "Adabor, Shaymoli"),
    ("Ward 40 - Lalmatia",          23.7562, 90.3705, "Lalmatia"),
]

# Waste-point offsets (relative) used to scatter bins within each ward
BIN_OFFSETS = [
    ( 0.002,  0.003), (-0.003,  0.002), ( 0.001, -0.004),
    (-0.002, -0.002), ( 0.004,  0.001), (-0.001,  0.003),
]

BIN_TEMPLATES = [
    ("Market waste bin",      lambda i: 55 + (i * 7) % 35),
    ("Roadside bin",          lambda i: 40 + (i * 13) % 45),
    ("Residential bin",       lambda i: 30 + (i * 11) % 50),
    ("Commercial bin",        lambda i: 65 + (i * 5) % 30),
    ("Park / open area bin",  lambda i: 20 + (i * 17) % 55),
    ("Bus stop bin",          lambda i: 70 + (i * 3) % 25),
]


# ── Overpass helpers ─────────────────────────────────────────────────────────

def overpass_query(ql: str, retries: int = 3) -> dict:
    """POST an Overpass QL query; return parsed JSON. Rate-limited."""
    for attempt in range(retries):
        try:
            resp = requests.post(
                OVERPASS_URL,
                data={"data": ql},
                headers={"User-Agent": USER_AGENT},
                timeout=60,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            wait = REQUEST_DELAY * (attempt + 1) * 2
            print(f"  Warning: Overpass error (attempt {attempt+1}/{retries}): {exc}. "
                  f"Retrying in {wait:.0f}s ...")
            time.sleep(wait)
    raise RuntimeError("Overpass API unavailable after retries.")


def fetch_dncc_wards() -> list:
    """
    Try to fetch DNCC ward boundaries from OSM.
    Returns list of {"name": str, "lat": float, "lon": float, "description": str}.
    Falls back to FALLBACK_WARDS on error.
    """
    print("Querying Overpass for DNCC ward boundaries ...")
    time.sleep(REQUEST_DELAY)

    ql = f"""
[out:json][timeout:60];
rel({DHAKA_DNCC_RELATION});
rel(r)[admin_level~"^(8|9|10)$"][name];
out center tags;
"""
    try:
        data = overpass_query(ql)
        elements = data.get("elements", [])
        wards = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name:en") or tags.get("name") or ""
            if not name:
                continue
            center = el.get("center", {})
            lat = center.get("lat")
            lon = center.get("lon")
            if not lat or not lon:
                continue
            desc = tags.get("description") or f"DNCC ward - {name}"
            wards.append({"name": name, "lat": lat, "lon": lon, "description": desc})
        if wards:
            print(f"  Retrieved {len(wards)} wards from OSM.")
            return wards
        else:
            print("  No ward boundaries returned by OSM; using curated fallback list.")
    except Exception as exc:
        print(f"  Overpass fetch failed: {exc}; using curated fallback list.")

    # Use fallback
    return [
        {"name": w[0], "lat": w[1], "lon": w[2], "description": w[3]}
        for w in FALLBACK_WARDS
    ]


def fetch_waste_points_for_ward(lat: float, lon: float, radius: int = 1000) -> list:
    """
    Query OSM waste_basket / waste_disposal nodes within `radius` metres of (lat, lon).
    Returns list of {"lat", "lon", "name"}.
    Respects the 1.6s delay between requests.
    """
    time.sleep(REQUEST_DELAY)
    ql = f"""
[out:json][timeout:30];
(
  node["amenity"="waste_basket"](around:{radius},{lat},{lon});
  node["amenity"="waste_disposal"](around:{radius},{lat},{lon});
  node["amenity"="waste_transfer_station"](around:{radius},{lat},{lon});
);
out body;
"""
    try:
        data = overpass_query(ql)
        results = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("ref") or "Waste point"
            results.append({"lat": el["lat"], "lon": el["lon"], "name": name})
        return results[:8]  # cap at 8 per ward
    except Exception:
        return []


# ── Database helpers ─────────────────────────────────────────────────────────

def get_connection():
    for driver in [
        "{ODBC Driver 17 for SQL Server}",
        "{ODBC Driver 13 for SQL Server}",
        "{SQL Server}",
    ]:
        try:
            cs = CONNECTION_STRING.replace("{ODBC Driver 17 for SQL Server}", driver)
            return pyodbc.connect(cs, autocommit=False)
        except pyodbc.Error:
            continue
    raise RuntimeError(
        "Cannot connect to SQL Server. Make sure SQLEXPRESS is running "
        "and ODBC Driver 17 (or 13) for SQL Server is installed.\n"
        "Download: https://aka.ms/downloadmsodbcsql"
    )


def ward_exists(cursor, name: str) -> bool:
    cursor.execute("SELECT 1 FROM Wards WHERE Name = ?", name)
    return cursor.fetchone() is not None


def insert_ward(cursor, name: str, description: str) -> int:
    cursor.execute(
        "INSERT INTO Wards (Name, Description) OUTPUT INSERTED.WardId VALUES (?, ?)",
        name, description
    )
    return cursor.fetchone()[0]


def insert_bin(cursor, ward_id: int, name: str,
               lat: float, lon: float, fill_pct: int):
    cursor.execute(
        """INSERT INTO Bins (WardId, Name, Latitude, Longitude,
                             CurrentFillPercent, LastUpdated)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ward_id, name, lat, lon, fill_pct,
        datetime.now(timezone.utc).replace(tzinfo=None)
    )


def make_synthetic_bins(ward_name: str, center_lat: float, center_lon: float,
                        ward_index: int) -> list:
    """Generate 4-6 synthetic bin positions spread around the ward centre."""
    bins = []
    count = 4 + (ward_index % 3)  # 4, 5, or 6 bins per ward
    for i in range(count):
        dlat, dlon = BIN_OFFSETS[i % len(BIN_OFFSETS)]
        jitter_lat = (random.random() - 0.5) * 0.0008
        jitter_lon = (random.random() - 0.5) * 0.0008
        template_name, fill_fn = BIN_TEMPLATES[i % len(BIN_TEMPLATES)]
        bins.append({
            "name": f"{ward_name} - {template_name} {i+1}",
            "lat": center_lat + dlat + jitter_lat,
            "lon": center_lon + dlon + jitter_lon,
            "fill": fill_fn(ward_index + i),
        })
    return bins


# ── Main ─────────────────────────────────────────────────────────────────────

def main(dry_run: bool):
    print("=" * 62)
    print(" SafaiTrack - Dhaka Ward Seeder (OSM / Overpass)")
    print("=" * 62)
    if dry_run:
        print("  DRY RUN - no database writes will occur.\n")

    wards = fetch_dncc_wards()
    print(f"\nWill process {len(wards)} ward(s).\n")

    if not dry_run:
        print("Connecting to SQL Server ...")
        conn = get_connection()
        cursor = conn.cursor()
        print("  Connected.\n")
    else:
        conn = cursor = None

    wards_inserted = 0
    wards_skipped = 0
    bins_inserted = 0

    for idx, ward in enumerate(wards):
        name = ward["name"]
        lat  = ward["lat"]
        lon  = ward["lon"]
        desc = ward["description"]

        print(f"[{idx+1:02d}/{len(wards)}] {name}")

        if not dry_run and ward_exists(cursor, name):
            print(f"       -> Already exists, skipping.\n")
            wards_skipped += 1
            continue

        print(f"       Fetching OSM waste points near ({lat:.4f}, {lon:.4f}) ...")
        osm_bins = fetch_waste_points_for_ward(lat, lon, radius=900)

        if osm_bins:
            print(f"       {len(osm_bins)} OSM waste point(s) found.")
            bins_to_insert = [
                {
                    "name": f"{name} - {b['name']}",
                    "lat":  b["lat"],
                    "lon":  b["lon"],
                    "fill": random.randint(20, 90),
                }
                for b in osm_bins
            ]
        else:
            print(f"       No OSM waste points; using synthetic bin positions.")
            bins_to_insert = make_synthetic_bins(name, lat, lon, idx)

        print(f"       Bins to seed: {len(bins_to_insert)}")
        for b in bins_to_insert:
            print(f"          * {b['name'][:55]:55s} fill={b['fill']:3d}%  "
                  f"({b['lat']:.5f}, {b['lon']:.5f})")

        if not dry_run:
            ward_id = insert_ward(cursor, name, desc)
            for b in bins_to_insert:
                insert_bin(cursor, ward_id, b["name"], b["lat"], b["lon"], b["fill"])
            conn.commit()
            print(f"       Saved ward (id={ward_id}) + {len(bins_to_insert)} bin(s).")

        wards_inserted += 1
        bins_inserted  += len(bins_to_insert)
        print()

    print("=" * 62)
    print(f"Done!")
    print(f"   Wards inserted : {wards_inserted}")
    print(f"   Wards skipped  : {wards_skipped} (already existed)")
    print(f"   Bins inserted  : {bins_inserted}")
    print("=" * 62)

    if not dry_run and conn:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Dhaka wards into SafaiTrack DB")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be inserted without writing to DB")
    args = parser.parse_args()
    random.seed(42)  # reproducible synthetic fill values
    main(dry_run=args.dry_run)
