import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {privateRoot} from './local-workflow.mjs';
import {encryptDocument,decryptDocument} from './documents.mjs';
function key(){mkdirSync(privateRoot,{recursive:true,mode:0o700});const file=resolve(privateRoot,'documents.key');if(!existsSync(file)){try{writeFileSync(file,randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}}return readFileSync(file);}
function path(id){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Недоступно');const folder=resolve(privateRoot,'documents');mkdirSync(folder,{recursive:true,mode:0o700});return resolve(folder,id+'.enc');}
export async function saveDocument(id,bytes){await writeFile(path(id),encryptDocument(bytes,key()),{flag:'wx',mode:0o600});}
export async function readDocument(id){return decryptDocument(await readFile(path(id)),key());}
export async function removeDocument(id){await unlink(path(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
