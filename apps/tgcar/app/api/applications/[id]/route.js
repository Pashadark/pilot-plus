import {localGuard,workflow,currentUser,json} from '../../../../server/local-workflow.mjs';
import {loadFleet} from '../../../../server/fleet-source.mjs';
import {publicVehicle} from '../../../../fleet.mjs';
export const runtime='nodejs';
export async function GET(request,{params}){try{const {id}=await params;return json({application:workflow().application(currentUser(request),id)});}catch{return json({error:'Заявка недоступна'},404);}}
export async function POST(request,{params}){try{localGuard(request,true);const user=currentUser(request),{id}=await params,body=await request.json(),store=workflow();
 if(body.action==='demo-documents')return json({application:store.demoDocuments(user,id)});
 if(body.action==='submit')return json({application:store.submit(user,id)});
 if(!['approve','reject','changes'].includes(body.action))throw new Error('Неизвестное действие');
 if(user.role!=='manager')throw new Error('Нужен доступ менеджера');
 let car=null;if(body.action==='approve'){const a=store.application(user,id),{cars}=await loadFleet();const raw=cars.find(c=>c.id===a.vehicleId);car=raw?publicVehicle(raw,a.period):null;}
 return json({application:store.review(user,id,body.action,body.reason,car)});
 }catch(e){return json({error:e.message},400);}}
