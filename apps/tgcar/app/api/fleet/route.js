import { loadFleet } from '../../../server/fleet-source.mjs';
import { periodFromQuery, publicVehicle } from '../../../fleet.mjs';
import {workflow} from '../../../server/local-workflow.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request) {
 let period;
 const headers={'Cache-Control':'no-store'};
 try {period=periodFromQuery(new URL(request.url).searchParams);} catch {return Response.json({error:'Укажите корректный будущий период аренды (до 366 дней).'}, {status:400,headers});}
 try {
  const {cars,time}=await loadFleet();
  const holds=process.env.NODE_ENV==='production'?[]:workflow().holds();
  return Response.json({cars:cars.map(car=>{const dto=publicVehicle(car,period);return holds.some(h=>h.vehicleId===car.id&&h.period[0]<period[1]&&h.period[1]>period[0])?{...dto,available:false,label:'Временная локальная бронь'}:dto;}),checkedAt:new Date(time).toISOString()}, {headers});
 } catch {return Response.json({error:'Нет связи с СУПА ПРО. Доступность не подтверждена. Повторите проверку.'},{status:503,headers});}
}
