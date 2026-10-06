export function leadComment(address,comment){
 const place=String(address || '').trim().slice(0,250);
 const note=String(comment || '').trim().slice(0,650);
 return [place && `Адрес подачи (по согласованию): ${place}`,note].filter(Boolean).join('\n');
}
