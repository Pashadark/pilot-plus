import {Readable} from 'node:stream';
import {prisma} from '@/database/prisma/client';
import {websiteCompany} from '@/modules/leads/website-access';
import {LocalPrivateStorage} from '@/services/storage/local-private-storage';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const companyId=websiteCompany(request);if(!companyId)return new Response('Unavailable',{status:401});
 const {id}=await params;if(!/^[a-z0-9-]+$/i.test(id))return new Response('Unavailable',{status:404});
 try{
 const image=await prisma.vehicleImage.findFirst({where:{vehicleId:id,sourceUrl:'private-upload',vehicle:{companyId,archivedAt:null,isDemoImport:false}},orderBy:[{isPrimary:'desc'},{position:'asc'}],select:{id:true}});
 const root=process.env.PRIVATE_STORAGE_ROOT;if(!image||!root)return new Response('Unavailable',{status:404});
 const storage=await LocalPrivateStorage.create(root);const stream=await storage.openPrivate(`companies/${companyId}/vehicles/${id}/images/${image.id}.webp`);
 return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Unavailable',{status:404});}
}
