import test from 'node:test';
import assert from 'node:assert/strict';
import { consentRecord, readConsent, validateClient, CONSENT_VERSION } from './privacy.mjs';
test('only necessary storage is permitted, with a version and expiry', () => {
 const saved=consentRecord(1000);
 assert.equal(saved.version,CONSENT_VERSION);
 assert.equal(saved.analytics,false);
 assert.equal(readConsent(JSON.stringify(saved),1001)?.necessary,true);
 assert.equal(readConsent(JSON.stringify(saved),saved.expiresAt+1),null);
});
test('malformed, stale, or expanded consent is rejected',()=>{
 for(const raw of ['', '{}', 'broken',JSON.stringify({...consentRecord(),version:'old'}),JSON.stringify({...consentRecord(),analytics:true})]) assert.equal(readConsent(raw),null);
});
test('client preview requires explicit, separate consent',()=>{
 const client={name:'Тестовый Клиент',phone:'+7 (999) 123-45-67',consent:false};
 assert.match(validateClient(client),/согласие/i);
 assert.equal(validateClient({...client,consent:true}),'');
 assert.match(validateClient({...client,name:' ',consent:true}),/имя/i);
 assert.match(validateClient({...client,phone:'123',consent:true}),/телефон/i);
});
