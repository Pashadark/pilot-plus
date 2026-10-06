export async function fleetApi(suffix='',env=process.env,send=fetch){
 const base=env.TGCAR_FLEET_URL,secret=env.TGCAR_LEAD_SECRET;
 if(!base||!secret||secret.length<32)throw new Error('SOURCE_CONFIGURATION');
 const url=new URL(base);if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('SOURCE_CONFIGURATION');
 const response=await send(base.replace(/\/$/,'')+suffix,{headers:{Authorization:'Bearer '+secret},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('SOURCE_UNAVAILABLE');return response;
}
