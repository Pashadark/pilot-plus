export function quote(start,end,rate,startTime='10:00',endTime='10:00') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  if (![startTime,endTime].every(t=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))) return null;
  const days = Math.ceil((Date.parse(end+'T'+endTime+':00+03:00')-Date.parse(start+'T'+startTime+':00+03:00'))/86400000);
  return Number.isFinite(days) && days>0 && Number.isFinite(rate) && rate>0 ? {days,total:days*rate} : null;
}
