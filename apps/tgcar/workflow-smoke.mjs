import assert from 'node:assert/strict';
const base='http://localhost:3105';
async function call(path,body,cookie){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(body?{'Content-Type':'application/json','Idempotency-Key':'smoke-'+Date.now()}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return {d,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const client=await call('/api/account',{action:'demo-login',role:'client'});
const manager=await call('/api/account',{action:'demo-login',role:'manager'});
const dates={start:'2026-10-10',end:'2026-10-11',startTime:'10:00',endTime:'10:00'};
const query=new URLSearchParams(dates);const fleet=await call('/api/fleet?'+query);const car=fleet.d.cars.find(c=>c.available&&c.rate);assert.ok(car,'priced available car');
const created=await call('/api/applications',{...dates,vehicleId:car.id,consent:true},client.cookie);const id=created.d.application.id;
await call('/api/applications/'+id,{action:'demo-documents'},client.cookie);
await call('/api/applications/'+id,{action:'submit'},client.cookie);
await call('/api/applications/'+id,{action:'approve'},manager.cookie);
const account=await call('/api/account',null,client.cookie);assert.equal(account.d.applications[0].status,'AWAITING_PAYMENT');
const after=await call('/api/fleet?'+query);assert.equal(after.d.cars.find(c=>c.id===car.id).available,false);
console.log('PASS local API: create → synthetic documents → submit → manager approve → account persistence → fleet hold. No real documents or messages.');
