'use client';
import { useEffect, useState } from 'react';
export function useFleet(start,end,startTime,endTime) {
 const queryKey=[start,end,startTime,endTime].join('|');
 const [result,setResult]=useState({cars:[],checkedAt:null,error:null,loading:true});
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let stopped=false,controller;
  const query=new URLSearchParams({start,end,startTime,endTime});
  async function refresh(){
   controller?.abort();controller=new AbortController();
   setResult(r=>({...r,loading:true,error:null}));
   try {
    const response=await fetch('/api/fleet?'+query,{signal:controller.signal,cache:'no-store'});
    const data=await response.json();
    if(stopped) return;
    if(!response.ok) throw new Error(data.error || 'Не удалось проверить доступность');
    setResult({...data,queryKey,error:null,loading:false});
   } catch(error){if(!stopped && error.name!=='AbortError') setResult(r=>({...r,error:error.message,loading:false,checkedAt:null}));}
  }
  refresh();const timer=setInterval(refresh,30000);
  const focus=()=>{if(!document.hidden) refresh();};document.addEventListener('visibilitychange',focus);
  return ()=>{stopped=true;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',focus);};
 },[start,end,startTime,endTime,revision]);
 return {...result,loading:result.loading || (result.queryKey!==queryKey && !result.error),refresh:()=>setRevision(r=>r+1)};
}
