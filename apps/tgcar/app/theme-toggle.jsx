'use client';
import {useEffect,useState} from 'react';
import {TbMoonFilled,TbSun} from 'react-icons/tb';
export default function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{setDark(document.documentElement.dataset.theme==='dark');const update=e=>{if(e.key==='tgcar-theme'&&(e.newValue==='dark'||e.newValue==='light')){document.documentElement.dataset.theme=e.newValue;setDark(e.newValue==='dark');}};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);},[]);
 function change(){const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem('tgcar-theme',next?'dark':'light');}catch{}}
 return <button type="button" className="theme-toggle" role="switch" aria-label="Тёмная тема" aria-checked={dark} title={dark?'Включить светлую тему':'Включить тёмную тему'} onClick={change}><span className="theme-track" aria-hidden="true"><TbSun className="theme-sun"/><TbMoonFilled className="theme-moon"/><span className="theme-handle"/></span></button>;
}
