import {prisma} from '@/database/prisma/client';
import {websiteCompany} from '@/modules/leads/website-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const companyId=websiteCompany(request);if(!companyId)return new Response('Unavailable',{status:401});
 try{
 const rows=await prisma.vehicle.findMany({where:{companyId,archivedAt:null,isDemoImport:false},select:{id:true,model:true,make:true,manufacturedYear:true,color:true,transmission:true,engineLiters:true,fuelType:true,seats:true,dailyPriceMinor:true,depositMinor:true,isRentalReady:true,status:true,images:{where:{sourceUrl:'private-upload'},orderBy:[{isPrimary:'desc'},{position:'asc'}],take:1,select:{id:true}},rentals:{where:{companyId,status:{in:['CONFIRMED','ACTIVE']}},select:{status:true,startsAt:true,endsAt:true}},maintenanceRecords:{where:{status:{notIn:['COMPLETED','CANCELLED']}},select:{status:true,scheduledAt:true,scheduledEndsAt:true}}},orderBy:[{model:'asc'},{id:'asc'}]});
 const cars=rows.map(({images,maintenanceRecords,engineLiters,depositMinor,...car})=>({...car,engineLiters:engineLiters?.toString()??null,depositMinor:depositMinor?.toString()??null,imageId:images[0]?.id??null,maintenance:maintenanceRecords}));
 return Response.json({cars},{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response('Unavailable',{status:503});}
}
