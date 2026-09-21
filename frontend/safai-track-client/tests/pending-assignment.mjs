import {chromium, expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const tag='DispatchQA'+Date.now(),password='DispatchPass123!';
const sql=s=>execFileSync('sqlcmd',['-S','localhost\\SQLEXPRESS','-d','SafaiTrackDb','-E','-I','-b','-h','-1','-W','-Q','SET NOCOUNT ON; '+s],{encoding:'utf8'}).trim();
async function api(path,token,method='GET',body){const r=await fetch('http://localhost:5281'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(await r.text());return r.status===204?null:r.json();}
try {
const admin=await api('/api/auth/login',null,'POST',{email:'admin@safaitrack.local',password:'Password123'});
const ward=Number(sql(`INSERT Wards(Name) VALUES('${tag}');SELECT SCOPE_IDENTITY()`));
const auth=await api('/api/auth/register',null,'POST',{email:tag+'@safaitrack.local',fullName:tag,password,role:'Citizen'});
const me=await api('/api/auth/me',auth.token);sql(`UPDATE AspNetUsers SET Role='Driver',WardId=${ward} WHERE Id='${me.id}'`);
const truck=await api('/api/trucks',admin.token,'POST',{plateNumber:tag,status:'Available'});
const rid=Number(sql(`INSERT Routes(WardId,Algorithm,TotalDistanceKm,Status,CreatedAt) VALUES(${ward},'Test pending route',0,'Pending',SYSUTCDATETIME());SELECT SCOPE_IDENTITY()`));
const bin=await api('/api/bins',admin.token,'POST',{wardId:ward,name:tag,latitude:23.7381,longitude:90.3725,currentFillPercent:80});
sql(`INSERT RouteStops(RouteId,BinId,StopSequence) VALUES(${rid},${bin.binId},1)`);
const assigned=await api(`/api/routes/${rid}/assign`,admin.token,'PUT',{driverId:me.id,truckId:truck.truckId});
if(assigned.driverId!==me.id||assigned.truckId!==truck.truckId)throw Error('Assignment failed');
if(assigned.status!=='AwaitingAcceptance')throw Error('Not awaiting acceptance');
const driver=await api('/api/auth/login',null,'POST',{email:tag+'@safaitrack.local',password});
await api(`/api/routes/${rid}/decline`,driver.token,'PUT');
const declined=await api(`/api/routes/${rid}`,admin.token);if(declined.status!=='Pending'||declined.driverId||declined.truckId)throw Error('Decline failed');
await api(`/api/routes/${rid}/assign`,admin.token,'PUT',{driverId:me.id,truckId:truck.truckId});
const browser=await chromium.launch({channel:'msedge',headless:true});
try { const page=await browser.newPage();await page.goto('http://localhost:3000/login');await page.getByLabel('Email address').fill(tag+'@safaitrack.local');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Awaiting acceptance'})).toBeVisible();await page.getByRole('button',{name:'Accept',exact:true}).click();await expect(page.locator('.ws-row').filter({hasText:`Route #${rid}`})).toContainText('In progress'); }finally{await browser.close();}
const accepted=await api(`/api/routes/${rid}`,driver.token);if(accepted.status!=='InProgress')throw Error('Accept failed');
const proof={declined,accepted,routeId:rid,before:'Pending / no driver / no truck',after:assigned,database:sql(`SELECT RouteId,Status,DriverId,TruckId FROM Routes WHERE RouteId=${rid}`)};writeFileSync('test-results/part5-acceptance.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{sql(`DELETE Routes WHERE WardId IN(SELECT WardId FROM Wards WHERE Name='${tag}');DELETE Bins WHERE Name='${tag}';DELETE Trucks WHERE PlateNumber='${tag}';DELETE AspNetUsers WHERE Email='${tag}@safaitrack.local';DELETE Wards WHERE Name='${tag}'`)}

