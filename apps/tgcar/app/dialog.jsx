'use client';
import {useEffect,useRef} from 'react';
import {TbX} from 'react-icons/tb';
export default function Dialog({children,onClose,label='Информация'}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current;const previousFocus=document.activeElement;const overflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=overflow;previousFocus?.focus?.();};},[]);
 return <dialog ref={ref} className="modal tg-dialog" aria-label={label} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
  <button className="modal-close" aria-label="Закрыть" onClick={onClose}><TbX aria-hidden="true"/></button>
  <div className="dialog-body">{children}</div>
 </dialog>;
}
