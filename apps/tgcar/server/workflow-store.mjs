import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {periodFromQuery} from '../fleet.mjs';
import {quote} from '../quote.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
export function createWorkflowStore(file,clock=Date.now){
 const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workflow (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');
 db.prepare('INSERT OR IGNORE INTO workflow VALUES(1,?)').run(JSON.stringify({users:[],sessions:[],applications:[],outbox:[]}));
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try {const data=JSON.parse(db.prepare('SELECT body FROM workflow WHERE id=1').get().body);const result=fn(data);db.prepare('UPDATE workflow SET body=? WHERE id=1').run(JSON.stringify(data));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 function audit(a,type,note=''){a.history.push({id:randomUUID(),type,note,at:new Date(clock()).toISOString()});a.updatedAt=new Date(clock()).toISOString();}
 function notice(data,a,type,audience='client'){const key=`${a.id}:${a.history.length}:${type}:${audience}`;if(!data.outbox.some(n=>n.key===key))data.outbox.push({id:randomUUID(),key,applicationId:a.id,userId:a.clientId,type,audience,status:'PENDING_CONFIGURATION',createdAt:new Date(clock()).toISOString()});}
 function expire(data){for(const a of data.applications)if(a.status==='AWAITING_PAYMENT' && a.holdUntil<=clock()){a.status='EXPIRED';a.holdUntil=null;audit(a,'EXPIRED','Срок локальной брони истёк');notice(data,a,'HOLD_EXPIRED');}}
 function find(data,user,id){const a=data.applications.find(a=>a.id===id);if(!a || !user || (user.role!=='manager' && a.clientId!==user.id))throw new Error('Недоступно');return a;}
 function manager(user){if(user?.role!=='manager')throw new Error('Нужен доступ менеджера');}
 const api={
  close:()=>db.close(),
  demoLogin(role){if(!['client','manager'].includes(role))throw new Error('Неверная роль');return transaction(data=>{const user={id:randomUUID(),role,name:role==='manager'?'Тестовый менеджер':'Тестовый клиент',phone:null,phoneVerified:false,isDemo:true,telegramLinked:false};data.users.push(user);const token=randomBytes(32).toString('hex');data.sessions.push({hash:hash(token),userId:user.id,expires:clock()+8*3600000});return {user,token};});},
  session(token){if(!token)return null;return transaction(data=>{data.sessions=data.sessions.filter(s=>s.expires>clock());const s=data.sessions.find(s=>s.hash===hash(token));return s ? data.users.find(u=>u.id===s.userId) || null:null;});},
  logout(token){transaction(data=>{data.sessions=data.sessions.filter(s=>s.hash!==hash(token || ''));});},
  account(user){return transaction(data=>{expire(data);return {user,applications:data.applications.filter(a=>a.clientId===user.id),rentals:[],fines:[],payments:[],notifications:{beforeEndHours:[24,3],telegramConnected:false}};});},
  application(user,id){return transaction(data=>{expire(data);return find(data,user,id);});},
  manager(user){manager(user);return transaction(data=>{expire(data);return {applications:data.applications,outbox:data.outbox};});},
  createApplication(user,input,car,key){
   if(user?.role!=='client' || !user.isDemo)throw new Error('Нужен вход клиента');
   if(input.consent!==true)throw new Error('Нужно отдельное согласие');
   if(typeof key!=='string' || key.length<3 || key.length>100)throw new Error('Неверный ключ заявки');
   const period=periodFromQuery(new URLSearchParams({start:input.start || '',end:input.end || '',startTime:input.startTime || '10:00',endTime:input.endTime || '10:00'}),clock());
   if(!input.start || !input.end || input.vehicleId!==car?.id || !car.available)throw new Error('Автомобиль занят или недоступен');
   const price=quote(input.start,input.end,car.rate,input.startTime,input.endTime);
   if(!price)throw new Error('Тариф не заполнен');
   return transaction(data=>{expire(data);const old=data.applications.find(a=>a.clientId===user.id && a.requestKey===key);if(old)return old;
    const a={id:randomUUID(),number:`LOCAL-${String(data.applications.length+1).padStart(5,'0')}`,clientId:user.id,isDemo:true,vehicleId:car.id,vehicleName:car.name,start:input.start,end:input.end,startTime:input.startTime||'10:00',endTime:input.endTime||'10:00',period,price,deposit:car.deposit,status:'DRAFT',documents:[],history:[],holdUntil:null,requestKey:key,consent:{version:'local-preview-2026-09-20',at:new Date(clock()).toISOString()},createdAt:new Date(clock()).toISOString()};
    audit(a,'CREATED','Создана локальная тестовая заявка');data.applications.push(a);return a;
   });
  },
  document(user,id,document){return transaction(data=>{const a=find(data,user,id);if(a.clientId!==user.id || !['DRAFT','NEEDS_CHANGES'].includes(a.status))throw new Error('Загрузка в этом статусе недоступна');if(a.documents.length>=6)throw new Error('Не более 6 загрузок');if(!['PASSPORT','LICENSE'].includes(document.kind))throw new Error('Неверный вид документа');if(!['CLEAN','QUARANTINED','BLOCKED'].includes(document.status))throw new Error('Неверная проверка');for(const old of a.documents.filter(d=>d.kind===document.kind))old.active=false;a.documents.push({...document,active:true,createdAt:new Date(clock()).toISOString()});audit(a,'DOCUMENT_UPLOADED',document.kind);return a;});},
  demoDocuments(user,id){if(!user.isDemo)throw new Error('Только тестовый профиль');api.document(user,id,{id:randomUUID(),kind:'PASSPORT',name:'Тестовый паспорт (без файла)',status:'CLEAN',synthetic:true});return api.document(user,id,{id:randomUUID(),kind:'LICENSE',name:'Тестовое ВУ (без файла)',status:'CLEAN',synthetic:true});},
  submit(user,id){return transaction(data=>{const a=find(data,user,id);if(a.clientId!==user.id || !['DRAFT','NEEDS_CHANGES'].includes(a.status))throw new Error('Нельзя отправить в этом статусе');for(const kind of ['PASSPORT','LICENSE'])if(!a.documents.some(d=>d.kind===kind && d.active && d.status!=='BLOCKED'))throw new Error('Загрузите оба документа');a.status='UNDER_REVIEW';audit(a,'SUBMITTED','Ожидается проверка документов');notice(data,a,'NEW_APPLICATION','staff');return a;});},
  review(user,id,action,reason,car){manager(user);return transaction(data=>{expire(data);const a=find(data,user,id);if(a.status!=='UNDER_REVIEW')throw new Error('Заявка уже обработана');const note=String(reason||'').trim();if(['changes','reject'].includes(action)&&(!note || note.length>1000))throw new Error('Укажите причину до 1000 символов');
   if(action==='approve'){
    if(!car?.available || car.id!==a.vehicleId)throw new Error('Автомобиль занят, обновите даты');
    if(!['PASSPORT','LICENSE'].every(kind=>a.documents.some(d=>d.active && d.kind===kind && d.status==='CLEAN')))throw new Error('Дождитесь антивирусной проверки документов');
    if(data.applications.some(b=>b.id!==id && b.vehicleId===a.vehicleId && b.status==='AWAITING_PAYMENT' && b.holdUntil>clock() && b.period[0]<a.period[1] && a.period[0]<b.period[1]))throw new Error('На это время уже есть локальная бронь');
    a.status='AWAITING_PAYMENT';a.holdUntil=clock()+30*60000;audit(a,'APPROVED','Локальная бронь на 30 минут; оплата не подключена');notice(data,a,'APPLICATION_APPROVED');
   }else if(action==='changes'){a.status='NEEDS_CHANGES';audit(a,'CHANGES_REQUESTED',note);notice(data,a,'DOCUMENT_CHANGES');}
   else if(action==='reject'){a.status='REJECTED';audit(a,'REJECTED',note);notice(data,a,'APPLICATION_REJECTED');}
   else throw new Error('Неизвестное действие');return a;
  });},
  holds(){return transaction(data=>{expire(data);return data.applications.filter(a=>a.status==='AWAITING_PAYMENT' && a.holdUntil>clock()).map(a=>({vehicleId:a.vehicleId,period:a.period,until:a.holdUntil}));});},
 };
 return api;
}
