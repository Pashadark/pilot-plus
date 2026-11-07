import {describe,it,expect} from 'vitest';
import {discountBadge} from './fine-card-presentation';
describe('discountBadge',()=>{
 const fine={status:'UNPAID',currentAmountMinor:'75000',originalAmountMinor:'150000',discountExpiresAt:'2026-09-23T20:59:59Z'};
 it('marks the last Moscow calendar day',()=>expect(discountBadge(fine,'2026-09-23T01:00:00Z')?.label).toBe('Скидка сегодня'));
 it('does not advertise expired or paid discounts',()=>{
 expect(discountBadge(fine,'2026-09-24T01:00:00Z')).toBeNull();
 expect(discountBadge({...fine,status:'PAID'},'2026-09-23T01:00:00Z')).toBeNull();
 expect(discountBadge({...fine,status:'ARCHIVED'},'2026-09-23T01:00:00Z')).toBeNull();
 });
 it('does not strike out equal amounts',()=>expect(discountBadge({...fine,currentAmountMinor:'150000'},'2026-09-23T01:00:00Z')).toBeNull());
});
