import pyodbc
conn = pyodbc.connect('Driver={ODBC Driver 18 for SQL Server};Server=localhost\\SQLEXPRESS;Database=SafaiTrackDb;Trusted_Connection=yes;TrustServerCertificate=yes;')
c = conn.cursor()
c.execute("SELECT RouteId, WardId, Status, DriverId, TruckId FROM Routes WHERE Status != 'Completed'")
rows = c.fetchall()
print(f"Total active/unfinished routes: {len(rows)}")
for r in rows:
    print(r)
