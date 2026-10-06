import { spawn } from 'node:child_process';
import {fleetApi} from './fleet-api.mjs';
// Local development bridge only. No credentials enter the browser or repository.
const company='cmrs7l57j0001tugce8rqv95q';
const key='C:/Users/pasahdark/.ssh/pilot_plus_beget_ed25519';
const host='root@201.24.51.103';
const sql=`BEGIN READ ONLY;
SET LOCAL statement_timeout = '5000ms';
SELECT coalesce(json_agg(t),'[]'::json) FROM (
 SELECT v.id,v.model,v.make,v."manufacturedYear",v.color,v.transmission,v."engineLiters",v."fuelType",v.seats,v."dailyPriceMinor",v."depositMinor",v."isRentalReady",v.status,
 (SELECT i.id FROM "VehicleImage" i WHERE i."vehicleId"=v.id AND i."sourceUrl"='private-upload' ORDER BY i."isPrimary" DESC,i.position LIMIT 1) AS "imageId",
 coalesce((SELECT json_agg(json_build_object('status',r.status,'startsAt',r."startsAt",'endsAt',r."endsAt")) FROM "Rental" r WHERE r."vehicleId"=v.id AND r."companyId"=v."companyId" AND r.status IN ('CONFIRMED','ACTIVE')),'[]'::json) AS rentals,
 coalesce((SELECT json_agg(json_build_object('status',m.status,'scheduledAt',m."scheduledAt",'scheduledEndsAt',m."scheduledEndsAt")) FROM "MaintenanceRecord" m WHERE m."vehicleId"=v.id AND m.status NOT IN ('COMPLETED','CANCELLED')),'[]'::json) AS maintenance
 FROM "Vehicle" v WHERE v."companyId"='${company}' AND v."archivedAt" IS NULL AND NOT v."isDemoImport" ORDER BY v.model,v.id
) t;
COMMIT;`;
function remote(command,input='') {
 if(process.env.NODE_ENV==='production') return Promise.reject(new Error('LOCAL_BRIDGE_ONLY'));
 return new Promise((resolve,reject)=>{
  const child=spawn('ssh',['-i',key,'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','-o','ConnectTimeout=5',host,command],{windowsHide:true});
  const chunks=[]; let size=0;
  const timer=setTimeout(()=>{child.kill();reject(new Error('SOURCE_TIMEOUT'));},12000);
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>12*1024*1024){child.kill();reject(new Error('SOURCE_TOO_LARGE'));}else chunks.push(chunk);});
  child.stderr.resume();
  child.on('error',()=>{clearTimeout(timer);reject(new Error('SOURCE_UNAVAILABLE'));});
  child.on('close',code=>{clearTimeout(timer);code===0?resolve(Buffer.concat(chunks)):reject(new Error('SOURCE_UNAVAILABLE'));});
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
let cache=null, pending=null;
export async function loadFleet() {
 if(process.env.NODE_ENV==='production'||process.env.TGCAR_FLEET_URL){const response=await fleetApi();const data=await response.json();if(!Array.isArray(data.cars))throw new Error('SOURCE_INVALID');return {cars:data.cars,time:Date.now()};}
 if(cache && Date.now()-cache.time<30000) return cache;
 if(pending) return pending;
 pending=remote('docker exec -i pilot-postgres psql -U pilot -d pilot -Atq -v ON_ERROR_STOP=1',sql).then(bytes=>{
   const cars=JSON.parse(bytes.toString('utf8'));if(!Array.isArray(cars)) throw new Error('SOURCE_INVALID');
   cache={cars,time:Date.now()};return cache;
 }).finally(()=>{pending=null;});
 return pending;
}
export async function loadPhoto(id) {
 if(process.env.NODE_ENV==='production'||process.env.TGCAR_FLEET_URL){if(!/^[a-z0-9-]+$/i.test(id))return null;const response=await fleetApi('/image/'+encodeURIComponent(id));const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>12*1024*1024)throw new Error('SOURCE_TOO_LARGE');return bytes;}
 const data=await loadFleet(); const car=data.cars.find(c=>c.id===id);
 if(!car?.imageId || !/^[a-z0-9]+$/i.test(car.id) || !/^[a-z0-9-]+$/i.test(car.imageId)) return null;
 return remote(`cat /opt/pilot-plus/shared/private/private/companies/${company}/vehicles/${car.id}/images/${car.imageId}.webp`);
}
