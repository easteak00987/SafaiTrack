"""Real HTTP/SQL integration checks against the isolated SafaiTrackCityAdminChecks copy.
Never points at the working database. Tokens/password hashes are not written to evidence.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
import requests
import pyodbc

BASE = 'http://localhost:5283'
db = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=SafaiTrackCityAdminChecks;Trusted_Connection=yes', autocommit=True)
assert db.cursor().execute('SELECT DB_NAME()').fetchval() == 'SafaiTrackCityAdminChecks'
tag = 'CA-' + uuid.uuid4().hex[:8]
evidence = {'testDatabase': 'SafaiTrackCityAdminChecks', 'startedAt': datetime.now(timezone.utc).isoformat(), 'fixture': tag, 'checks': []}

def check(name, value):
    evidence['checks'].append({'check': name, 'proof': value})
    print('PASS:', name)

def call(method, path, token=None, body=None, expected=200, form=None):
    headers = {'Authorization': 'Bearer ' + token} if token else {}
    response = requests.request(method, BASE + path, headers=headers, json=body if form is None else None, data=form, allow_redirects=False, timeout=40)
    assert response.status_code == expected, f'{method} {path}: {response.status_code} {response.text[:700]}'
    if response.status_code == 302: return response.headers['Location']
    return response.json() if response.content else None

def sql(statement, *args):
    cur = db.cursor().execute(statement, *args)
    return cur

def login(email, password='CityCheck123!', admin=False):
    return call('POST', '/api/auth/' + ('city-admin/login' if admin else 'login'), body={'email': email, 'password': password})['token']

admin = login('admin@safaitrack.local', os.environ.get('SAFAITRACK_TEST_ADMIN_PASSWORD', 'Password123'), True)
ward = sql('INSERT INTO Wards(Name,Description) OUTPUT INSERTED.WardId VALUES (?,?)', tag, 'Isolated integration fixture').fetchval()
truck = sql('INSERT INTO Trucks(PlateNumber,Status) OUTPUT INSERTED.TruckId VALUES (?,?)', tag, 'Available').fetchval()
bins = [sql('INSERT INTO Bins(WardId,Name,Latitude,Longitude,CurrentFillPercent,LastUpdated) OUTPUT INSERTED.BinId VALUES (?,?,?,?,90,SYSUTCDATETIME())', ward, f'{tag} bin {i}', 23.75+i*.0001, 90.38+i*.0001).fetchval() for i in range(6)]

users = {}
for role in ['Citizen', 'Driver', 'WardOfficer']:
    email = f'{tag}-{role}@example.test'
    payload = {'fullName': f'{tag} {role}', 'email': email, 'password': 'CityCheck123!', 'role': role, 'phoneNumber': '01712345678', 'gender': 'Female', 'wardId': ward, 'requestedWardId': ward}
    registered = call('POST', '/api/auth/register', body=payload)
    assert registered['status'] == 'PendingApproval' and not registered['token']
    denied = call('POST', '/api/auth/login', body={'email': email, 'password': payload['password']}, expected=401)
    pending = call('GET', '/api/auth/pending-approvals', admin)
    user = next(u for u in pending if u['email'] == email)
    call('PUT', f"/api/auth/pending-approvals/{user['id']}/approve", admin, {'wardId': ward})
    users[role] = {'id': user['id'], 'email': email, 'token': login(email)}
    check(f'{role} requires approval and then logs in', {'registration': registered['status'], 'beforeApproval': denied, 'databaseStatus': sql('SELECT Status FROM AspNetUsers WHERE Id=?', user['id']).fetchval()})

c, d, o = [users[r]['token'] for r in ['Citizen', 'Driver', 'WardOfficer']]
call('POST', '/api/auth/register', body={**payload, 'email': f'{tag}-admin@example.test', 'role': 'Admin'}, expected=400)
call('POST', '/api/auth/login', body={'email':'admin@safaitrack.local','password':os.environ.get('SAFAITRACK_TEST_ADMIN_PASSWORD','Password123')}, expected=403)
call('GET', '/api/city-admin/people/Citizen', c, expected=403)
check('City Admin entrance and APIs enforce role separation', {'publicAdminRegistration':400, 'regularAdminLogin':403, 'citizenDirectoryAccess':403})

rejected_email = f'{tag}-declined@example.test'
call('POST','/api/auth/register',body={**payload,'email':rejected_email,'role':'Citizen'})
rejected_id = sql('SELECT Id FROM AspNetUsers WHERE Email=?', rejected_email).fetchval()
call('DELETE',f'/api/auth/pending-approvals/{rejected_id}/reject',admin)
call('POST','/api/auth/login',body={'email':rejected_email,'password':'CityCheck123!'},expected=401)
check('Declined registration is retained and cannot log in', sql('SELECT Status FROM AspNetUsers WHERE Id=?',rejected_id).fetchval())

call('POST', '/api/invoices/generate', admin, {})
draft = next(x for x in call('GET','/api/city-admin/billing-drafts',admin) if x['citizenId']==users['Citizen']['id'])
assert call('GET','/api/invoices',c)==[]
sent = call('POST',f"/api/city-admin/billing-drafts/{draft['billingDraftId']}/send",admin,{})
call('POST',f"/api/city-admin/billing-drafts/{draft['billingDraftId']}/send",admin,{})
invoices = call('GET','/api/invoices',c)
assert len(invoices)==1 and invoices[0]['status']=='Unpaid'
assert any(n.get('link')=='/billing' for n in call('GET','/api/notifications',c))
check('Proposal is private until send; repeat send creates one invoice', {'draft':draft,'beforeSend':[],'afterSend':invoices})
older_checkout = call('POST','/api/payments/initiate',c,{'invoiceId':sent['invoiceId']})
checkout = call('POST','/api/payments/initiate',c,{'invoiceId':sent['invoiceId']})
assert checkout['gateway']=='Simulated', 'These checks must not make a real payment'
redirect = call('POST','/api/payments/simulated-checkout/complete',form={'tran_id':checkout['transactionRef'],'outcome':'success','method':'bKash'},expected=302)
invoice = call('GET','/api/invoices',c)[0]
assert invoice['status']=='AwaitingApproval' and invoice['paidAt'] is None
call('POST','/api/payments/initiate',c,{'invoiceId':sent['invoiceId']},expected=409)
payment = next(p for p in call('GET','/api/city-admin/payment-approvals',admin) if p['transactionRef']==checkout['transactionRef'])
check('Verified gateway payment waits for City Admin and blocks double payment', {'redirect':redirect,'invoice':invoice,'review':payment})
call('PUT',f"/api/city-admin/payment-approvals/{payment['paymentId']}",admin,{'approve':False})
assert call('GET','/api/invoices',c)[0]['status']=='ReviewHold'
call('POST','/api/payments/initiate',c,{'invoiceId':sent['invoiceId']},expected=409)
call('PUT',f"/api/city-admin/payment-approvals/{payment['paymentId']}",admin,{'approve':True})
assert call('GET','/api/invoices',c)[0]['status']=='Paid'
check('Decline holds payment; later approval settles without a second charge', {'gatewayStatus':sql('SELECT Status FROM Payments WHERE PaymentId=?',payment['paymentId']).fetchval(),'reviewStatus':sql('SELECT ReviewStatus FROM Payments WHERE PaymentId=?',payment['paymentId']).fetchval(),'invoice':call('GET','/api/invoices',c)[0]})
call('POST','/api/payments/simulated-checkout/complete',form={'tran_id':older_checkout['transactionRef'],'outcome':'success','method':'bKash'},expected=302)
assert call('GET','/api/invoices',c)[0]['status']=='Paid'
assert sql('SELECT ReviewStatus FROM Payments WHERE TransactionRef=?',older_checkout['transactionRef']).fetchval()=='Duplicate'
check('Late success from superseded checkout cannot reopen a paid invoice', {'duplicateReview':'Duplicate','invoiceStatus':'Paid'})

complaint=call('POST','/api/complaints',c,{'binId':bins[0],'category':'Overflow','description':tag},expected=201)
assert any(x['complaintId']==complaint['complaintId'] for x in call('GET','/api/complaints',o))
for state in ['InProgress','Resolved']:
    call('PUT',f"/api/complaints/{complaint['complaintId']}/status",o,{'status':state,'message':tag})
route=call('POST','/api/routes/generate',o,{'wardId':ward,'driverId':users['Driver']['id'],'truckId':truck,'algorithm':'nearest_neighbor'},expected=201)
rid=route['routeId']
call('PUT',f'/api/routes/{rid}/optimize',o,{})
driver_route=next(r for r in call('GET','/api/routes',d) if r['routeId']==rid)
assert driver_route['status']=='AwaitingAcceptance'
call('PUT',f'/api/routes/{rid}/accept',d,{})
driver_route=call('GET',f'/api/routes/{rid}',d)
for stop in driver_route['stops']:
    call('PUT',f"/api/routes/{rid}/stops/{stop['routeStopId']}/collect",d,{})
call('PUT',f'/api/routes/{rid}/complete',d,{})
call('PUT',f'/api/routes/{rid}/complete',d,{},expected=409)
officer=next(p for p in call('GET','/api/city-admin/people/WardOfficer',admin) if p['id']==users['WardOfficer']['id'])
driver=next(p for p in call('GET','/api/city-admin/people/Driver',admin) if p['id']==users['Driver']['id'])
assert officer['complaintsHandled']==1 and officer['wardResolved']==1 and officer['assignments24h']==1 and officer['optimizations24h']==2
assert driver['completedRoutes']==1 and driver['collectedBins']==6
check('Directory metrics come from complaint, dispatch and collection endpoints', {'officer':officer,'driver':driver,'routeStatus':sql('SELECT Status FROM Routes WHERE RouteId=?',rid).fetchval()})

wage=call('GET','/api/wages',d)[0]
assert wage['amount']==1320 and wage['bonusAmount']==220 and not wage['eligible']
wid=wage['driverWageId']
call('PUT',f'/api/city-admin/wages/{wid}/release',admin,{},expected=409)
call('PUT',f'/api/wages/{wid}/collect',d,{},expected=409)
assert sql('SELECT COUNT(*) FROM WageContributions WHERE RouteId=?',rid).fetchval()==1
check('Completion accrues one wage; release blocked before 24 hours', wage)
# A second route in the same work period must increase incentives, not pay the base twice.
sql('UPDATE Bins SET CurrentFillPercent=90 WHERE WardId=?',ward)
same_day_route=call('POST','/api/routes/generate',o,{'wardId':ward,'driverId':users['Driver']['id'],'truckId':truck,'algorithm':'nearest_neighbor'},expected=201)['routeId']
call('PUT',f'/api/routes/{same_day_route}/accept',d,{})
for stop in call('GET',f'/api/routes/{same_day_route}',d)['stops']:
    call('PUT',f"/api/routes/{same_day_route}/stops/{stop['routeStopId']}/collect",d,{})
call('PUT',f'/api/routes/{same_day_route}/complete',d,{})
daily_wages=call('GET','/api/wages',d)
assert len(daily_wages)==1 and daily_wages[0]['driverWageId']==wid
assert daily_wages[0]['routesCompleted']==2 and daily_wages[0]['binsCollected']==12
assert daily_wages[0]['amount']==1680 and daily_wages[0]['bonusAmount']==280
check('Two routes share one daily base and aggregate all bin incentives',daily_wages[0])
# Advance only this isolated test fixture's clock by 24h; no waiting or production data edits.
sql('UPDATE DriverWages SET PeriodStart=DATEADD(hour,-25,PeriodStart),PeriodEnd=DATEADD(hour,-25,PeriodEnd) WHERE DriverWageId=?',wid)
call('PUT',f'/api/city-admin/wages/{wid}/release',admin,{})
call('PUT',f'/api/city-admin/wages/{wid}/release',admin,{})
ready=call('GET','/api/wages',d)[0]
assert ready['status']=='ReadyForCollection'
assert sum(n.get('title')=='Your daily wages are ready' and n.get('link')=='/driver/wages' for n in call('GET','/api/notifications',d))==1
call('PUT',f'/api/wages/{wid}/defer',d,{})
assert call('GET','/api/wages',d)[0]['deferredAt']
call('PUT',f'/api/wages/{wid}/collect',c,{},expected=403)
collected=call('PUT',f'/api/wages/{wid}/collect',d,{})
call('PUT',f'/api/wages/{wid}/collect',d,{})
admin_wage=next(w for w in call('GET','/api/city-admin/wages',admin) if w['driverWageId']==wid)
assert admin_wage['status']=='Collected' and admin_wage['collectedAt']
check('Release, notification, defer and collection persist and are idempotent', {'clockNote':'Only this test record was shifted 25 hours to exercise the closed-period gate.','released':ready,'collectResponse':collected,'adminAfterCollection':admin_wage})
citizen=next(p for p in call('GET','/api/city-admin/people/Citizen',admin) if p['id']==users['Citizen']['id'])
assert citizen['complaintsFiled']==1 and citizen['bills'][0]['status']=='Paid'
check('Citizen directory reflects actual complaints and confirmed bills',citizen)
# Prepare a second earned wage for browser collect/defer checks using real route APIs.
sql('UPDATE Bins SET CurrentFillPercent=90 WHERE WardId=?',ward)
next_route=call('POST','/api/routes/generate',o,{'wardId':ward,'driverId':users['Driver']['id'],'truckId':truck,'algorithm':'nearest_neighbor'},expected=201)['routeId']
call('PUT',f'/api/routes/{next_route}/accept',d,{})
for stop in call('GET',f'/api/routes/{next_route}',d)['stops']:
    call('PUT',f"/api/routes/{next_route}/stops/{stop['routeStopId']}/collect",d,{})
call('PUT',f'/api/routes/{next_route}/complete',d,{})
next_wage=call('GET','/api/wages',d)[0]['driverWageId']
sql('UPDATE DriverWages SET PeriodStart=DATEADD(hour,-25,PeriodStart),PeriodEnd=DATEADD(hour,-25,PeriodEnd) WHERE DriverWageId=?',next_wage)
call('PUT',f'/api/city-admin/wages/{next_wage}/release',admin,{})
evidence['browserFixture']={'wageId':next_wage,'wardId':ward}
evidence['passed']=True
Path('artifacts').mkdir(exist_ok=True)
Path('artifacts/city-admin-e2e.json').write_text(json.dumps(evidence,indent=2,ensure_ascii=False),encoding='utf-8')
print(f"All {len(evidence['checks'])} scenario checks passed. Evidence: artifacts/city-admin-e2e.json")
