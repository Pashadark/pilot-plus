import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkflowStore} from './server/workflow-store.mjs';
const car={id:'car-a',name:'Toyota Camry',rate:4500,deposit:15000,available:true};
const input={vehicleId:car.id,start:'2026-10-03',end:'2026-10-06',startTime:'10:00',endTime:'10:00',consent:true};
function setup(){const store=createWorkflowStore(':memory:');const client=store.demoLogin('client');const manager=store.demoLogin('manager');return {store,client,manager};}
test('sessions opaque, own applications isolated, duplicate submission idempotent',()=>{
 const {store,client}=setup(); const other=store.demoLogin('client');
 const a=store.createApplication(client.user,input,car,'req-one');
 assert.equal(store.createApplication(client.user,input,car,'req-one').id,a.id);
 assert.equal(store.account(other.user).applications.length,0);
 assert.throws(()=>store.application(other.user,a.id),/Недоступно/);
 assert.equal(store.session(client.token).id,client.user.id);
 store.logout(client.token);assert.equal(store.session(client.token),null);store.close();
});
test('documents needed, manager roles enforced, revision audit and local hold conflict',()=>{
 const {store,client,manager}=setup();const a=store.createApplication(client.user,input,car,'first');
 assert.throws(()=>store.submit(client.user,a.id),/документ/);
 store.demoDocuments(client.user,a.id);store.submit(client.user,a.id);
 assert.throws(()=>store.review(client.user,a.id,'approve','',car),/менеджер/);
 assert.throws(()=>store.review(manager.user,a.id,'approve','',{...car,available:false}),/занят/);
 const approved=store.review(manager.user,a.id,'approve','',car);
 assert.equal(approved.status,'AWAITING_PAYMENT');assert.ok(approved.holdUntil);
 const second=store.demoLogin('client');const b=store.createApplication(second.user,input,car,'second');store.demoDocuments(second.user,b.id);store.submit(second.user,b.id);
 assert.throws(()=>store.review(manager.user,b.id,'approve','',car),/бронь/);
 assert.equal(store.account(client.user).applications[0].history.at(-1).type,'APPROVED');
 assert.ok(store.manager(manager.user).outbox.every(n=>n.status==='PENDING_CONFIGURATION'));
 store.close();
});
test('changes request, resubmit and reject preserve timeline, no silent payment',()=>{
 const {store,client,manager}=setup();const a=store.createApplication(client.user,input,car,'one');store.demoDocuments(client.user,a.id);store.submit(client.user,a.id);
 assert.throws(()=>store.review(manager.user,a.id,'changes','',car),/причин/);
 store.review(manager.user,a.id,'changes','Проверьте разворот',car);
 assert.equal(store.application(client.user,a.id).status,'NEEDS_CHANGES');
 store.submit(client.user,a.id);store.review(manager.user,a.id,'reject','Недостаточно данных',car);
 assert.equal(store.application(client.user,a.id).status,'REJECTED');
 assert.throws(()=>store.submit(client.user,a.id),/статус/);store.close();
});
test('quarantined files cannot approve',()=>{
 const {store,client,manager}=setup();const a=store.createApplication(client.user,input,car,'one');
 store.document(client.user,a.id,{id:'d1',kind:'PASSPORT',status:'QUARANTINED',name:'test.pdf'});
 store.document(client.user,a.id,{id:'d2',kind:'LICENSE',status:'QUARANTINED',name:'test.pdf'});
 store.submit(client.user,a.id);assert.throws(()=>store.review(manager.user,a.id,'approve','',car),/провер/);
 store.close();
});
test('expired holds released with audit',()=>{
 let now=Date.parse('2026-09-20T10:00:00Z');const store=createWorkflowStore(':memory:',()=>now);const c=store.demoLogin('client'),m=store.demoLogin('manager');const a=store.createApplication(c.user,input,car,'expiry');store.demoDocuments(c.user,a.id);store.submit(c.user,a.id);store.review(m.user,a.id,'approve','',car);assert.equal(store.holds().length,1);now+=31*60000;assert.equal(store.holds().length,0);assert.equal(store.application(c.user,a.id).status,'EXPIRED');store.close();
});
