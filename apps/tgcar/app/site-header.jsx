'use client';
import {useEffect,useRef,useState} from 'react';
import {TbMenu2,TbX,TbArrowUpRight} from 'react-icons/tb';
import ThemeToggle from './theme-toggle';
const links=[['fleet','Автопарк'],['how','Условия аренды'],['journal','Блог'],['contacts','Контакты']];
export default function SiteHeader({onHome,about=false,external=false,blog=false}) {
 const [menuOpen,setMenuOpen]=useState(false);
 const [compact,setCompact]=useState(false);
 const [active,setActive]=useState('');
 const [signedIn,setSignedIn]=useState(false);
 const toggle=useRef(null);
 useEffect(()=>{
  const check=()=>fetch('/api/customer',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>setSignedIn(Boolean(d?.user))).catch(()=>setSignedIn(false));
  check();window.addEventListener('focus',check);return()=>window.removeEventListener('focus',check);
 },[]);
 useEffect(()=>{
  const scroll=()=>setCompact(window.scrollY>32);
  const hash=()=>setActive(window.location.hash.slice(1));
  scroll();hash();
  window.addEventListener('scroll',scroll,{passive:true});
  window.addEventListener('hashchange',hash);
  return()=>{window.removeEventListener('scroll',scroll);window.removeEventListener('hashchange',hash);};
 },[]);
 function escape(event){if(event.key==='Escape'&&menuOpen){setMenuOpen(false);toggle.current?.focus();}}
 function navigate(id){setMenuOpen(false);setActive(id);if(id!=='contacts')onHome?.();}
 return <header className={`site-header${compact?' is-compact':''}${menuOpen?' menu-open':''}`} onKeyDown={escape}>
  <a className="brand" href={about||external?'/':'#'} onClick={()=>{navigate('');}}>TG <b>CAR</b></a>
  <nav id="site-navigation" aria-label="Основная навигация">
   {links.map(([id,title])=><a key={id} href={id==='journal'?'/blog':`${about||external?'/':''}#${id}`} className={(id==='journal'&&blog)||active===id?'nav-active':''} aria-current={id==='journal'&&blog?'page':active===id?'location':undefined} onClick={()=>navigate(id)}>{title}</a>)}
   <a href="/about" className={about?'nav-active':''} aria-current={about?'page':undefined}>О нас</a>
  </nav>
  <ThemeToggle/>
  <a className="header-phone" href="tel:+79175761177">+7 (917) 576-11-77</a>
  <a className="header-cta outline customer-cta" href="/profile">{signedIn?'Профиль':'Войти'} <TbArrowUpRight aria-hidden="true"/></a>
  <button ref={toggle} className="menu-toggle" aria-label={menuOpen?'Закрыть меню':'Открыть меню'} aria-expanded={menuOpen} aria-controls="site-navigation" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<TbX aria-hidden="true"/>:<TbMenu2 aria-hidden="true"/>}</button>
 </header>;
}
