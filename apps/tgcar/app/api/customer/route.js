import {customers,customerToken,sessionCookie} from '../../../server/customer-auth.mjs';
import {allowedOrigin} from '../../../server/request-origin.mjs';
export const runtime='nodejs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){try{return json({user:customers().session(customerToken(request))});}catch{return json({error:'Вход временно недоступен'},503);}}
export async function POST(request){
 if(!allowedOrigin(request))return json({error:'Источник запроса не разрешён'},403);
 try{
 const text=await request.text();if(Buffer.byteLength(text)>4096)return json({error:'Слишком большой запрос'},413);
 const body=JSON.parse(text),store=customers();
 if(body.action==='logout'){store.logout(customerToken(request));const response=json({user:null});response.headers.set('Set-Cookie',sessionCookie(''));return response;}
 if(!['register','login'].includes(body.action))return json({error:'Неизвестное действие'},400);
 store.limit('ip:'+(request.headers.get('x-real-ip')||'local'));
 store.limit('phone:'+String(body.phone||'').replace(/\D/g,'').slice(-10));
 const result=body.action==='register'?await store.register(body):await store.login(body.phone,body.password);
 store.logout(customerToken(request));
 const response=json({user:result.user});response.headers.set('Set-Cookie',sessionCookie(result.token));return response;
 }catch(error){return json({error:error.status===429?error.message: 'Не удалось войти или создать профиль. Проверьте телефон, пароль (10–128 символов) и согласие. Если профиль уже есть, выберите «Войти».'},error.status===429?429:400);}
}
