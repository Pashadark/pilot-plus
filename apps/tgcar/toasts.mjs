export function addToast(items, notice) {
 const kind=['success','error','warning','info'].includes(notice.kind)?notice.kind:'info';
 const item={...notice,kind,duration:kind==='error'||kind==='warning'?null:kind==='success'?6000:8000};
 return [...items.filter(i=>i.id!==item.id),item].slice(-3);
}
