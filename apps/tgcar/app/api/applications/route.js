import {localGuard,workflow,currentUser,json} from '../../../server/local-workflow.mjs';
import {loadFleet} from '../../../server/fleet-source.mjs';
import {periodFromQuery,publicVehicle} from '../../../fleet.mjs';
export const runtime='nodejs';
export async function POST(request){try{localGuard(request,true);const user=currentUser(request);const body=await request.json();const query=new URLSearchParams(body);const period=periodFromQuery(query);const {cars}=await loadFleet();const raw=cars.find(c=>c.id===body.vehicleId);if(!raw)throw new Error('Автомобиль недоступен');return json({application:workflow().createApplication(user,body,publicVehicle(raw,period),request.headers.get('idempotency-key'))},201);}catch(e){return json({error:e.message},400);}}
