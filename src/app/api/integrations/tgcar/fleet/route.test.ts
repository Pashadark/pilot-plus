import {afterEach, expect, it, vi} from 'vitest';
const findMany=vi.hoisted(()=>vi.fn());
vi.mock('@/database/prisma/client',()=>({prisma:{vehicle:{findMany}}}));
import {GET} from './route';
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();});
function configure(){vi.stubEnv('TGCAR_LEAD_SECRET','x'.repeat(40));vi.stubEnv('TGCAR_LEAD_COMPANY_ID','company-test');}
const request=(token='x'.repeat(40))=>new Request('http://localhost/fleet',{headers:{Authorization:'Bearer '+token}});
it('rejects absent configuration and incorrect credentials before querying',async()=>{
 vi.stubEnv('TGCAR_LEAD_SECRET','');expect((await GET(request())).status).toBe(401);
 configure();expect((await GET(request('wrong'))).status).toBe(401);
 expect(findMany).not.toHaveBeenCalled();
});
it('scopes inventory and rentals to the configured company and selects no client identifiers',async()=>{
 configure();findMany.mockResolvedValue([{id:'car',engineLiters:null,depositMinor:BigInt(2000000),images:[],maintenanceRecords:[]}]);
 const response=await GET(request());expect(response.status).toBe(200);
 const query=findMany.mock.calls[0][0];
 expect(query.where).toEqual({companyId:'company-test',archivedAt:null,isDemoImport:false});
 expect(query.select.rentals.where.companyId).toBe('company-test');
 expect(query.select.rentals.select).toEqual({status:true,startsAt:true,endsAt:true});
 expect(query.select).not.toHaveProperty('vin');expect(query.select).not.toHaveProperty('registrationNumber');
 expect((await response.json()).cars[0].depositMinor).toBe('2000000');
 expect(response.headers.get('cache-control')).toBe('no-store');
});
it('does not expose database errors',async()=>{
 configure();findMany.mockRejectedValue(new Error('private connection details'));
 const response=await GET(request());expect(response.status).toBe(503);expect(await response.text()).toBe('Unavailable');
});
