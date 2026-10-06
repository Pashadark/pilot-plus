'use client';
import {createContext,useContext,useState,useCallback,useEffect} from 'react';
import {FiCheck,FiAlertCircle,FiInfo,FiX} from 'react-icons/fi';
import {addToast} from '../toasts.mjs';
const ToastContext=createContext(null);
export const useToast=()=>useContext(ToastContext);
function Toast({notice,dismiss}){
 const [paused,setPaused]=useState(false);
 const [hidden,setHidden]=useState(false);
 useEffect(()=>{const check=()=>setHidden(document.hidden);check();document.addEventListener('visibilitychange',check);return()=>document.removeEventListener('visibilitychange',check)},[]);
 useEffect(()=>{if(paused||hidden||notice.duration===null)return;const timer=setTimeout(()=>dismiss(notice.id),notice.duration);return()=>clearTimeout(timer)},[notice,paused,hidden,dismiss]);
 const Icon=notice.kind==='success'?FiCheck:notice.kind==='error'||notice.kind==='warning'?FiAlertCircle:FiInfo;
 return <div className={'toast toast-'+notice.kind} role={notice.kind==='error'?'alert':'status'} aria-atomic="true" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)}}>
  <span className="toast-icon"><Icon aria-hidden="true" size={20}/></span><div className="toast-copy"><strong>{notice.title}</strong>{notice.message&&<p>{notice.message}</p>}</div><button className="toast-close" aria-label={'Закрыть уведомление: '+notice.title} onClick={()=>dismiss(notice.id)}><FiX aria-hidden="true" size={19}/></button>
 </div>;
}
export default function ToastProvider({children}){
 const [items,setItems]=useState([]);
 const notify=useCallback(notice=>setItems(prev=>addToast(prev,{...notice,id:notice.id||crypto.randomUUID()})),[]);
 const dismiss=useCallback(id=>setItems(prev=>prev.filter(i=>i.id!==id)),[]);
 return <ToastContext.Provider value={notify}>{children}<div className="toast-stack" aria-label="Уведомления">{items.map(item=><Toast key={item.id} notice={item} dismiss={dismiss}/>)}</div></ToastContext.Provider>;
}
