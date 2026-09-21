import urllib.request, json, pyodbc

def post(url, data, token=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    if token: req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def get(url, token=None):
    req = urllib.request.Request(url)
    if token: req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def delete(url, token=None):
    req = urllib.request.Request(url, method='DELETE')
    if token: req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def put(url, data, token=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), method='PUT', headers={'Content-Type': 'application/json'})
    if token: req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

print('1. Register Citizen:')
status, res = post('http://localhost:5281/api/auth/register', {
    'email': 'test_citizen@safaitrack.local',
    'fullName': 'Test Citizen',
    'password': 'Password123!',
    'role': 'Citizen'
})
print('   Status:', status, 'Token present?', bool(res.get('token')))

print('\n2. Register WardOfficer without ward:')
status, res = post('http://localhost:5281/api/auth/register', {
    'email': 'test_officer_noward@safaitrack.local',
    'fullName': 'Test Officer',
    'password': 'Password123!',
    'role': 'WardOfficer'
})
print('   Status:', status, 'Message:', res.get('message'))

print('\n3. Register WardOfficer with ward 29 (Gulshan):')
status, res = post('http://localhost:5281/api/auth/register', {
    'email': 'test_officer_pending@safaitrack.local',
    'fullName': 'Pending Officer',
    'password': 'Password123!',
    'role': 'WardOfficer',
    'requestedWardId': 29
})
print('   Status:', status, 'Response status:', res.get('status'), 'Message:', res.get('message'))

print('\n4. Login as Pending WardOfficer:')
status, res = post('http://localhost:5281/api/auth/login', {
    'email': 'test_officer_pending@safaitrack.local',
    'password': 'Password123!'
})
print('   Status:', status, 'Message:', res.get('message'))

print('\n5. Register Driver:')
status, res = post('http://localhost:5281/api/auth/register', {
    'email': 'test_driver_pending@safaitrack.local',
    'fullName': 'Pending Driver',
    'password': 'Password123!',
    'role': 'Driver'
})
print('   Status:', status, 'Response status:', res.get('status'), 'Message:', res.get('message'))

# Login as admin
_, admin_login = post('http://localhost:5281/api/auth/login', {'email': 'admin@safaitrack.local', 'password': 'Password123'})
admin_token = admin_login['token']

print('\n6. Admin views pending approvals:')
status, pending_list = get('http://localhost:5281/api/auth/pending-approvals', admin_token)
print(f'   Status: {status}, Total Pending: {len(pending_list)}')
for p in pending_list:
    print(f'   - {p["email"]} ({p["role"]}, Ward: {p["requestedWardName"]})')

# Approve officer
officer_id = [p['id'] for p in pending_list if p['email'] == 'test_officer_pending@safaitrack.local'][0]
print(f'\n7. Admin approves officer {officer_id}:')
status, approve_res = put(f'http://localhost:5281/api/auth/pending-approvals/{officer_id}/approve', {}, admin_token)
print('   Status:', status, 'Message:', approve_res.get('message'), 'Assigned WardId:', approve_res.get('wardId'))

print('\n8. Approved officer can now log in:')
status, login_res = post('http://localhost:5281/api/auth/login', {
    'email': 'test_officer_pending@safaitrack.local',
    'password': 'Password123!'
})
print('   Status:', status, 'Token present?', bool(login_res.get('token')), 'Role:', login_res.get('role'))

# Reject driver
driver_id = [p['id'] for p in pending_list if p['email'] == 'test_driver_pending@safaitrack.local'][0]
print(f'\n9. Admin rejects driver {driver_id}:')
status, reject_res = delete(f'http://localhost:5281/api/auth/pending-approvals/{driver_id}/reject', admin_token)
print('   Status:', status, 'Message:', reject_res.get('message'))

# Clean up test accounts
conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=SafaiTrackDb;Trusted_Connection=yes;TrustServerCertificate=yes;')
cur = conn.cursor()
cur.execute("DELETE FROM AspNetUserRoles WHERE UserId IN (SELECT Id FROM AspNetUsers WHERE Email IN ('test_citizen@safaitrack.local', 'test_officer_pending@safaitrack.local', 'test_driver_pending@safaitrack.local'))")
cur.execute("DELETE FROM AspNetUsers WHERE Email IN ('test_citizen@safaitrack.local', 'test_officer_pending@safaitrack.local', 'test_driver_pending@safaitrack.local')")
conn.commit()
print('Cleaned up test accounts successfully.')
