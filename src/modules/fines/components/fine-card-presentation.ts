type DiscountFine = {status:string;currentAmountMinor:string;originalAmountMinor:string;discountExpiresAt?:string|null};
export function discountBadge(fine:DiscountFine,now:string){
 if(fine.status==='PAID'||fine.status==='CANCELLED'||!fine.discountExpiresAt||BigInt(fine.currentAmountMinor)>=BigInt(fine.originalAmountMinor))return null;
 const expires=Date.parse(fine.discountExpiresAt), current=Date.parse(now);
 if(!Number.isFinite(expires)||!Number.isFinite(current)||expires<current)return null;
 const days=Math.floor((expires+10800000)/86400000)-Math.floor((current+10800000)/86400000);
 return {label:days===0?'Скидка сегодня':days===1?'Скидка завтра':`Скидка · ${days} дн.`,tone:days===0?'danger' as const:days<=7?'warning' as const:'neutral' as const,expires};
}
