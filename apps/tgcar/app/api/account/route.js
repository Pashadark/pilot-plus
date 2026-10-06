import {localGuard,workflow,currentUser,sessionToken,json} from '../../../server/local-workflow.mjs';
export const runtime='nodejs';
export async function GET(request){try{return json(workflow().account(currentUser(request)));}catch{return json({error:'Войдите в личный кабинет',integrations:{sms:false,telegram:false,payments:false}},401);}}
export async function POST(request){try{localGuard(request,true);const body=await request.json();if(body.action==='logout'){workflow().logout(sessionToken(request));const response=json({ok:true});response.headers.set('Set-Cookie','tgcar-local-session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return response;}
 if(body.action!=='demo-login')return json({error:'Подтверждение телефона ещё не подключено. Реальная регистрация недоступна.'},503);
 const {user,token}=workflow().demoLogin(body.role);const response=json({user});response.headers.set('Set-Cookie',`tgcar-local-session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);return response;
 }catch{return json({error:'Не удалось выполнить вход'},400);}}
