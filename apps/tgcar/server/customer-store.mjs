import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash,createHmac,createCipheriv,createDecipheriv,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const hash=v=>createHash('sha256').update(v).digest('hex');
function phoneOf(value){let p=String(value||'').replace(/\D/g,'');if(p.length===11&&p[0]==='8')p='7'+p.slice(1);if(!/^7\d{10}$/.test(p))throw new Error('Укажите телефон в формате +7 и 10 цифр');return p;}
export function createCustomerStore(file,secret,clock=Date.now){
 if(!/^[a-f0-9]{64}$/i.test(secret||''))throw new Error('Customer encryption key missing');
 const key=Buffer.from(secret,'hex'),db=new DatabaseSync(file);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,phone_key TEXT UNIQUE NOT NULL,profile TEXT NOT NULL,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS customer_sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS customer_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);');
 const index=p=>createHmac('sha256',key).update(p).digest('hex');
 function encrypt(p){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(JSON.stringify(p)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');}
 function decrypt(p){const b=Buffer.from(p,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());}
 function dto(row){return row?{id:row.id,...decrypt(row.profile),phoneVerified:false,telegramLinked:false}:null;}
 function issue(row){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM customer_sessions WHERE expires<=?').run(clock());db.prepare('INSERT INTO customer_sessions VALUES(?,?,?)').run(hash(token),row.id,clock()+7*86400000);return {user:dto(row),token};}
 return {
 close:()=>db.close(),
 limit(value){const k=index(value),now=clock();db.prepare('DELETE FROM customer_limits WHERE expires<=?').run(now);db.prepare('INSERT INTO customer_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(k,now+15*60000);if(db.prepare('SELECT count FROM customer_limits WHERE key=?').get(k).count>5){const e=new Error('Слишком много попыток. Попробуйте через 15 минут.');e.status=429;throw e;}},
 async register(input){
 const phone=phoneOf(input.phone),name=typeof input.name==='string'?input.name.trim():'';
 if(name.length<2||name.length>100)throw new Error('Укажите имя: от 2 до 100 символов');
 if(input.consent!==true)throw new Error('Нужно согласие на обработку персональных данных');
 if(typeof input.password!=='string'||input.password.length<10||input.password.length>128)throw new Error('Пароль должен содержать от 10 до 128 символов');
 const salt=randomBytes(16).toString('hex'),digest=await derive(input.password,salt,64);
 const row={id:randomUUID(),profile:encrypt({name,phone,createdAt:new Date(clock()).toISOString(),consentVersion:'2026-09-21'}),password:salt+':'+digest.toString('hex')};
 try{db.prepare('INSERT INTO customers VALUES(?,?,?,?)').run(row.id,index(phone),row.profile,row.password);}catch(e){if(String(e.message).includes('UNIQUE'))throw new Error('Не удалось зарегистрироваться. Если у вас есть профиль, войдите с паролем.');throw e;}
 return issue(row);
 },
 async login(value,password){const phone=phoneOf(value);if(typeof password!=='string'||password.length>128)throw new Error('Неверный телефон или пароль');const row=db.prepare('SELECT * FROM customers WHERE phone_key=?').get(index(phone));const [salt,digest]=(row?.password||'00000000000000000000000000000000:'+ '00'.repeat(64)).split(':');const actual=await derive(password,salt,64);if(!timingSafeEqual(actual,Buffer.from(digest,'hex'))||!row)throw new Error('Неверный телефон или пароль');return issue(row);},
 session(token){if(!/^[a-f0-9]{64}$/.test(token||''))return null;return dto(db.prepare('SELECT c.* FROM customers c JOIN customer_sessions s ON s.user_id=c.id WHERE s.hash=? AND s.expires>?').get(hash(token),clock()));},
 logout(token){db.prepare('DELETE FROM customer_sessions WHERE hash=?').run(hash(token||''));}
 };
}
