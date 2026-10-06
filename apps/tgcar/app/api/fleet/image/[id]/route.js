import { loadPhoto } from '../../../../../server/fleet-source.mjs';
export const runtime='nodejs';
export async function GET(request,{params}) {
 try {const {id}=await params; const photo=await loadPhoto(id);
  if(photo) return new Response(photo,{headers:{'Content-Type':'image/webp','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
 } catch {}
 return new Response('Фото недоступно',{status:404});
}
