'use client';
import {useState} from 'react';
export default function Share({title}){const [status,setStatus]=useState('');async function share(){try{if(navigator.share){await navigator.share({title,url:window.location.href});}else{await navigator.clipboard.writeText(window.location.href);setStatus('Ссылка скопирована');}}catch(error){if(error.name!=='AbortError')setStatus('Скопируйте адрес статьи из адресной строки');}}return <div className="blog-share"><button className="outline" type="button" onClick={share}>Поделиться статьёй ↗</button><span role="status">{status}</span></div>}
