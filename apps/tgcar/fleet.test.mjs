import test from 'node:test';
import assert from 'node:assert/strict';
import { periodFromQuery, availability, publicVehicle } from './fleet.mjs';
const now = Date.parse('2026-09-20T09:00:00Z');
const car = {id:'car1',model:'Kia Rio',isRentalReady:true,dailyPriceMinor:300000,depositMinor:1500000,rentals:[],maintenance:[]};
const period = [Date.parse('2026-09-21T07:00:00Z'),Date.parse('2026-09-22T07:00:00Z')];
test('Moscow dates and time, rejects invalid dates and reversed ranges',()=>{
 assert.deepEqual(periodFromQuery(new URLSearchParams('start=2026-09-21&end=2026-09-22&startTime=10:00&endTime=10:00'),now),period);
 for(const query of ['start=2026-02-30&end=2026-03-02','start=2026-09-21','start=2026-09-22&end=2026-09-21']) assert.throws(()=>periodFromQuery(new URLSearchParams(query),now));
});
test('half open overlap blocks confirmed and active, not completed/cancelled/draft',()=>{
 for (const status of ['ACTIVE','CONFIRMED','COMPLETED','CANCELLED','DRAFT']) {
 const v={...car,rentals:[{status,startsAt:'2026-09-21T07:00:00Z',endsAt:'2026-09-22T07:00:00Z'}]};
 assert.equal(availability(v,period,now).available,!['ACTIVE','CONFIRMED'].includes(status));
 }
 assert.equal(availability({...car,rentals:[{status:'CONFIRMED',startsAt:'2026-09-20T07:00:00Z',endsAt:'2026-09-21T07:00:00Z'}]},period,now).available,true);
});
test('overdue active rentals, unready vehicles and repairs fail closed',()=>{
 assert.equal(availability({...car,rentals:[{status:'ACTIVE',startsAt:'2026-09-10T00:00:00Z',endsAt:'2026-09-19T00:00:00Z'}]},period,now).available,false);
 assert.equal(availability({...car,isRentalReady:false},period,now).available,false);
 assert.equal(availability({...car,maintenance:[{status:'IN_PROGRESS'}]},period,now).available,false);
 assert.equal(availability({...car,maintenance:[{status:'PLANNED',scheduledAt:'2026-09-21T08:00:00Z',scheduledEndsAt:'2026-09-21T09:00:00Z'}]},period,now).available,false);
});
test('DTO whitelist, missing price stays unknown and private data stripped',()=>{
 const result=publicVehicle({...car,dailyPriceMinor:0,vin:'secret',client:{name:'private'},registrationNumber:'private',rentals:[]},period,now);
 assert.equal(result.rate,null);
 assert.equal(result.deposit,15000);
 assert.equal(result.name,'Kia Rio');
 for(const key of ['vin','client','registrationNumber','rentals','maintenance','companyId']) assert.equal(key in result,false);
});
test('future open-ended maintenance does not block earlier trips',()=>{
 assert.equal(availability({...car,maintenance:[{status:'PLANNED',scheduledAt:'2026-10-10T07:00:00Z',scheduledEndsAt:null}]},period,now).available,true);
 assert.equal(availability({...car,maintenance:[{status:'PLANNED',scheduledAt:null,scheduledEndsAt:null}]},period,now).available,true);
});
