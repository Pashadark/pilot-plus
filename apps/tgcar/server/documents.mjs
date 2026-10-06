import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {createConnection} from 'node:net';
export function validateDocument(bytes){
 if(!bytes.length || bytes.length>5*1024*1024)throw new Error('Размер документа должен быть от 1 байта до 5 МБ');
 if(bytes.subarray(0,5).toString()==='%PDF-')return {mime:'application/pdf',extension:'pdf'};
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',extension:'png'};
 if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return {mime:'image/jpeg',extension:'jpg'};
 throw new Error('Разрешены JPG, PNG и PDF');
}
export function encryptDocument(bytes,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);}
export function decryptDocument(bytes,key){const cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]);}
export async function scanDocument(bytes,env=process.env){
 if(!env.TGCAR_CLAMAV_HOST || !env.TGCAR_CLAMAV_PORT)return 'QUARANTINED';
 return new Promise(resolve=>{
  let settled=false;const chunks=[];let size=0;const socket=createConnection({host:env.TGCAR_CLAMAV_HOST,port:Number(env.TGCAR_CLAMAV_PORT)});
  const done=status=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();resolve(status);};
  const timer=setTimeout(()=>done('QUARANTINED'),10000);
  socket.on('error',()=>done('QUARANTINED'));
  socket.on('connect',()=>{socket.write('zINSTREAM\0');const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length);socket.write(length);socket.write(bytes);socket.write(Buffer.alloc(4));});
  socket.on('data',chunk=>{size+=chunk.length;if(size>4096)return done('QUARANTINED');chunks.push(chunk);if(chunk.includes(0)){const text=Buffer.concat(chunks).toString().replace(/\0/g,'').trim();done(/^stream: OK$/.test(text)?'CLEAN':/ FOUND$/.test(text)?'BLOCKED':'QUARANTINED');}});
  socket.on('end',()=>done('QUARANTINED'));
 });
}
