import {randomUUID} from 'node:crypto';
import {localGuard,workflow,currentUser,json} from '../../../../../server/local-workflow.mjs';
import {validateDocument,scanDocument} from '../../../../../server/documents.mjs';
import {saveDocument,removeDocument} from '../../../../../server/document-storage.mjs';
export const runtime='nodejs';
export async function POST(request,{params}){
 let savedId=null;
 try{localGuard(request,true);const user=currentUser(request),{id}=await params,store=workflow();const application=store.application(user,id);
 if(application.clientId!==user.id || !['DRAFT','NEEDS_CHANGES'].includes(application.status))throw new Error('Загрузка недоступна');
 if(application.documents.length>=6)throw new Error('Доступно до 6 загрузок в локальной заявке');
 const size=Number(request.headers.get('content-length'));if(!size || size>5*1024*1024+16384)throw new Error('Файл превышает 5 МБ');
 const form=await request.formData(),file=form.get('file'),kind=form.get('kind');if(!['PASSPORT','LICENSE'].includes(kind) || !file || typeof file.arrayBuffer!=='function')throw new Error('Выберите документ');
 const bytes=Buffer.from(await file.arrayBuffer()),format=validateDocument(bytes),status=await scanDocument(bytes),docId=randomUUID();
 if(status!=='BLOCKED'){await saveDocument(docId,bytes);savedId=docId;}
 const updated=store.document(user,id,{id:docId,kind,name:`${kind==='PASSPORT'?'Паспорт':'Водительское удостоверение'}.${format.extension}`,mime:format.mime,status,synthetic:false});
 return json({application:updated,message:status==='CLEAN'?'Документ прошёл антивирусную проверку':status==='BLOCKED'?'Файл заблокирован антивирусом':'Файл сохранён зашифрованным. Ожидает антивирусной проверки; одобрение пока недоступно.'});
 }catch(e){if(savedId)await removeDocument(savedId);return json({error:e.message},400);}
}
