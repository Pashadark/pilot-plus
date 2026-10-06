import test from 'node:test';
import assert from 'node:assert/strict';
import {leadComment} from './lead-comment.mjs';
test('optional delivery address survives within existing encrypted comment limit',()=>{
 assert.equal(leadComment('  Москва, дом 1 ',' Встреча '),'Адрес подачи (по согласованию): Москва, дом 1\nВстреча');
 assert.equal(leadComment('',''),'');
 assert.equal(leadComment('','Только офис'),'Только офис');
 assert.ok(leadComment('а'.repeat(300),'б'.repeat(1000)).length<1000);
});
