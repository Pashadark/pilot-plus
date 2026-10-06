import {timingSafeEqual} from 'node:crypto';
export function websiteCompany(request:Request){
 const secret=process.env.TGCAR_LEAD_SECRET,company=process.env.TGCAR_LEAD_COMPANY_ID;
 const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(!secret||secret.length<32||!company||Buffer.byteLength(secret)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))return null;
 return company;
}
