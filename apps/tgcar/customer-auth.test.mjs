import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomerStore} from './server/customer-store.mjs';
test('register, password login, opaque sessions and logout; phone remains unverified',async()=>{
 const s=createCustomerStore(':memory:','a'.repeat(64));
 try {const a=await s.register({name:'Иван',phone:'+7 (917) 123-45-67',password:'Long-password-123',consent:true});
 assert.equal(a.user.phoneVerified,false);assert.equal(a.user.phone,'79171234567');
 assert.equal(s.session(a.token).id,a.user.id);
 assert.equal(s.session('invalid'),null);
 await assert.rejects(s.login('79171234567','wrong password'));
 const b=await s.login('89171234567','Long-password-123');assert.equal(b.user.id,a.user.id);
 await assert.rejects(s.register({name:'Other',phone:'79171234567',password:'Long-password-123',consent:true}));
 s.logout(a.token);assert.equal(s.session(a.token),null);assert.ok(s.session(b.token));
 }finally{s.close();}
});
test('rejects missing consent, invalid phone and weak password',async()=>{
 const s=createCustomerStore(':memory:','b'.repeat(64));try{
 for(const patch of [{consent:false},{phone:'123'},{password:'short'}])await assert.rejects(s.register({name:'Иван',phone:'79171234567',password:'Long-password-123',consent:true,...patch}));
 }finally{s.close();}
});
test('persistent throttle and session expiry',async()=>{
 let now=1000000;const s=createCustomerStore(':memory:','c'.repeat(64),()=>now);try{
 for(let i=0;i<5;i++)s.limit('ip');assert.throws(()=>s.limit('ip'));
 now+=16*60*1000;s.limit('ip');
 const a=await s.register({name:'Иван',phone:'79171234567',password:'Long-password-123',consent:true});
 now+=8*24*3600000;assert.equal(s.session(a.token),null);
 }finally{s.close();}
});
