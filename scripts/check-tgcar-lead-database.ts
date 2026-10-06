import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {PrismaClient} from '../src/database/generated/prisma';
import {receiveWebsiteLead} from '../src/modules/leads/website-intake';
import {decryptField} from '../src/services/security/field-encryption';

async function main(){
 const url=new URL(process.env.DATABASE_URL||'');
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/tgcar_launch_check')throw new Error('Only isolated local tgcar_launch_check database is allowed');
 const db=new PrismaClient();
 try{
  const suffix=randomUUID();const company=await db.company.create({data:{name:'TG CAR — isolated integration fixture',slug:'tgcar-check-'+suffix,isDemo:true}});
  const user=await db.user.create({data:{name:'Fixture manager',email:suffix+'@example.test',passwordHash:'disabled-fixture-no-login',memberships:{create:{companyId:company.id,role:'COMPANY_ADMIN'}}}});
  const vehicle=await db.vehicle.create({data:{companyId:company.id,sourceKey:suffix,internalNumber:'TEST',model:'Fixture car',city:'Москва',transmission:'АКПП',fuelType:'PETROL',seats:5,dailyPriceMinor:450000,currency:'RUB',originalPrice:'fixture',isDemoImport:true}});
  const config={companyId:company.id,userId:user.id,encryptionKey:randomBytes(32).toString('base64'),searchKey:randomBytes(32).toString('hex')};
  const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
  const input={requestId:randomUUID(),name:'Синтетическая заявка',phone:'+7 999 123-45-67',vehicleId:vehicle.id,start:day(2),end:day(5),startTime:'10:00',endTime:'10:00',comment:'Изолированный тест, не звонить',consent:true};
  const first=await receiveWebsiteLead(input,config,db);const second=await receiveWebsiteLead(input,config,db);
  assert.equal(first.id,second.id);assert.equal(second.duplicate,true);
  const row=await db.lead.findUniqueOrThrow({where:{id:first.id}});assert.equal(row.status,'NEW');assert.equal(row.source,'TG CAR');assert.equal(decryptField(row.phoneEncrypted,config.encryptionKey),'79991234567');assert.match(decryptField(row.commentEncrypted!,config.encryptionKey),/Телефон не подтверждён/);
  assert.equal(await db.lead.count({where:{companyId:company.id}}),1);assert.equal(await db.auditLog.count({where:{companyId:company.id,entityId:first.id}}),1);assert.equal(await db.rental.count({where:{companyId:company.id}}),0);assert.equal(await db.client.count({where:{companyId:company.id}}),0);
  await assert.rejects(()=>receiveWebsiteLead({...input,name:'Изменено'},config,db),/CONFLICT/);
  await assert.rejects(()=>receiveWebsiteLead({...input,requestId:randomUUID(),phone:''},config,db),/INVALID/);
  console.log('PASS PostgreSQL: one NEW TG CAR lead, encrypted contact, one audit, idempotent retry, changed-payload rejection, required phone, no rental/client created. Isolated fixture only.');
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error('TG CAR isolated integration check failed');process.exitCode=1;});
