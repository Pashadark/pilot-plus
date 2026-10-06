export function periodFromQuery(query, now = Date.now()) {
  const start=query.get('start'), end=query.get('end');
  if (!start && !end) return [now, now+60000];
  function parse(date,time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('INVALID_PERIOD');
    const midnight=Date.parse(date+'T00:00:00Z');
    if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0,10)!==date) throw new Error('INVALID_PERIOD');
    return Date.parse(date+'T'+time+':00+03:00');
  }
  const range=[parse(start,query.get('startTime') || '10:00'),parse(end,query.get('endTime') || '10:00')];
  if(range[1]<=range[0] || range[1]-range[0]>366*86400000 || range[0]<now-60000) throw new Error('INVALID_PERIOD');
  return range;
}
export function availability(vehicle,period,now=Date.now()) {
  const overlap=(start,end)=>Date.parse(start)<period[1] && Date.parse(end)>period[0];
  if ((vehicle.rentals || []).some(r=>r.status==='ACTIVE' && Date.parse(r.endsAt)<now)) return {available:false,label:'Возврат ещё не подтверждён'};
  if ((vehicle.rentals || []).some(r=>['CONFIRMED','ACTIVE'].includes(r.status) && overlap(r.startsAt,r.endsAt))) return {available:false,label:'Занята на выбранное время'};
  if(vehicle.status==='MAINTENANCE' || (vehicle.maintenance || []).some(m=>['IN_PROGRESS','DAMAGE_REPORTED','WAITING_REPAIR','OVERDUE'].includes(m.status) || (m.status==='PLANNED' && m.scheduledAt && (m.scheduledEndsAt ? overlap(m.scheduledAt,m.scheduledEndsAt) : Date.parse(m.scheduledAt)<period[1])))) return {available:false,label:'Обслуживание · уточните доступность'};
  if(!vehicle.isRentalReady) return {available:false,label:'Выдача пока не разрешена'};
  return {available:true,label:'Свободна'};
}
export function publicVehicle(v,period,now=Date.now()) {
  const amount=(n)=>n!=null && Number.isFinite(Number(n)) && Number(n)>=0 ? Number(n)/100 : null;
  return {id:v.id,name:v.model,group:v.make || v.model.split(' ')[0],year:v.manufacturedYear || null,
    rate:Number(v.dailyPriceMinor)>0 ? amount(v.dailyPriceMinor):null,deposit:amount(v.depositMinor),
    engine:v.engineLiters ? `${v.engineLiters} л`:'Не указан',fuel:({PETROL:'Бензин',DIESEL:'Дизель',HYBRID:'Гибрид',ELECTRIC:'Электро'})[v.fuelType] || 'Не указано',
    transmission:v.transmission || 'Не указана',seats:v.seats || null,color:v.color || 'Не указан',
    office:'Москва, Зелёный проспект, 22',image:v.imageId ? `/api/fleet/image/${v.id}`:null,
    ...availability(v,period,now)};
}
