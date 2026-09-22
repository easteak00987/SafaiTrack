import pyodbc

conn = pyodbc.connect(
    'Driver={ODBC Driver 18 for SQL Server};'
    'Server=localhost\\SQLEXPRESS;'
    'Database=SafaiTrackDb;'
    'Trusted_Connection=yes;'
    'TrustServerCertificate=yes;'
)
c = conn.cursor()

# Delete duplicates keeping only truck 1 and 2
c.execute('DELETE FROM Trucks WHERE TruckId > 2')
conn.commit()
c.execute('SELECT COUNT(*) FROM Trucks')
print('After cleanup:', c.fetchone()[0], 'trucks')

# Insert 28 more trucks (total = 30)
zones = ['TA', 'MH', 'GS', 'MI', 'UT', 'KA', 'MO', 'LA', 'BA', 'DR']
plates = []
num = 101
for zone in zones:
    for i in range(3):
        plates.append(f'DHK-{zone}-{num:03d}')
        num += 1

# Only take 28
plates = plates[:28]
for plate in plates:
    c.execute('INSERT INTO Trucks (PlateNumber, Status) VALUES (?, ?)', (plate, 'Available'))

conn.commit()
c.execute('SELECT COUNT(*) FROM Trucks')
print('Total trucks now:', c.fetchone()[0])
c.execute('SELECT TruckId, PlateNumber, Status FROM Trucks ORDER BY TruckId')
for r in c.fetchall():
    print(f'  #{r[0]:2d}  {r[1]:<22s}  [{r[2]}]')
conn.close()
