import {workflow,currentUser,json} from '../../../server/local-workflow.mjs';
export const runtime='nodejs';
export async function GET(request){try{return json(workflow().manager(currentUser(request)));}catch{return json({error:'Нужен тестовый вход менеджера'},403);}}
