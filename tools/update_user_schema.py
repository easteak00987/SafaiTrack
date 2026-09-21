import pyodbc

conn_str = 'DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=SafaiTrackDb;Trusted_Connection=yes;TrustServerCertificate=yes;'
conn = pyodbc.connect(conn_str)
cur = conn.cursor()

cols = [c.column_name for c in cur.columns(table='AspNetUsers')]
if 'Status' not in cols:
    cur.execute("ALTER TABLE AspNetUsers ADD Status nvarchar(50) NOT NULL CONSTRAINT DF_AspNetUsers_Status DEFAULT N'Active'")
    print('Added Status column')
else:
    print('Status column already exists')

if 'RequestedWardId' not in cols:
    cur.execute('ALTER TABLE AspNetUsers ADD RequestedWardId int NULL')
    cur.execute('ALTER TABLE AspNetUsers ADD CONSTRAINT FK_AspNetUsers_Wards_RequestedWardId FOREIGN KEY (RequestedWardId) REFERENCES Wards (WardId)')
    print('Added RequestedWardId column and FK')
else:
    print('RequestedWardId column already exists')

cur.execute("UPDATE AspNetUsers SET Status = 'Active' WHERE Status IS NULL OR Status = ''")
conn.commit()
print('Committed database schema update successfully.')
