import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createWorkflowStore} from './workflow-store.mjs';
export const privateRoot=resolve(process.cwd(),'.tgcar-private');
let store;
export function workflow(){if(process.env.NODE_ENV==='production')throw new Error('Локальный процесс отключён в production');if(!store){mkdirSync(privateRoot,{recursive:true,mode:0o700});store=createWorkflowStore(resolve(privateRoot,'workflow.sqlite'));}return store;}
export function localGuard(request,mutation=false){
 if(process.env.NODE_ENV==='production')throw new Error('Локальный процесс отключён в production');
 const url=new URL(request.url);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Доступ только локально');
 if(mutation && request.headers.get('origin')!==url.origin)throw new Error('Источник запроса не разрешён');
}
export function sessionToken(request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('tgcar-local-session='))?.slice('tgcar-local-session='.length) || '';}
export function currentUser(request){localGuard(request);const user=workflow().session(sessionToken(request));if(!user)throw new Error('Войдите в личный кабинет');return user;}
export function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
