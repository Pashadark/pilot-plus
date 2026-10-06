import test from 'node:test';
import assert from 'node:assert/strict';
import { quote } from './quote.mjs';
test('calculates full rental days, deposit separately', () => {
  assert.deepEqual(quote('2026-10-01','2026-10-04',6000), { days:3, total:18000 });
});
test('rejects reversed or absent dates', () => {
  assert.equal(quote('2026-10-04','2026-10-01',6000),null);
  assert.equal(quote('','',6000),null);
});
test('charges started rental days using selected Moscow times',()=>{
 assert.deepEqual(quote('2026-10-02','2026-10-03',3000,'10:00','11:00'),{days:2,total:6000});
 assert.deepEqual(quote('2026-10-02','2026-10-02',3000,'10:00','18:00'),{days:1,total:3000});
 assert.equal(quote('2026-10-02','2026-10-03',3000,'25:00','10:00'),null);
});
