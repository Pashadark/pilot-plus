export function allowedOrigin(request,env=process.env){
 const expected=env.TGCAR_PUBLIC_ORIGIN;
 if(env.NODE_ENV==='production' && (!expected || !expected.startsWith('https://')))return false;
 return request.headers.get('origin')===(expected || new URL(request.url).origin);
}
