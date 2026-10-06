import {it,expect,vi} from 'vitest';
const find=vi.hoisted(()=>vi.fn().mockResolvedValue([]));
vi.mock('@/database/prisma/client',()=>({prisma:{maintenanceRecord:{findMany:find}}}));
import {searchDates} from './server-dates';
it('date search without client rights only reads tenant vehicle maintenance',async()=>{
 const range={from:'2026-09-21T21:00:00.000Z',to:'2026-09-22T21:00:00.000Z'};
 expect(await searchDates(range,'u2',null,null)).toEqual([]);
 expect(find.mock.calls[0][0].where).toEqual({vehicle:{company:{members:{some:{userId:'u2'}}}},scheduledAt:{gte:new Date(range.from),lt:new Date(range.to)}});
});
