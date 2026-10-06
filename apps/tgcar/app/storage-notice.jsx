'use client';
import { useEffect, useState } from 'react';
import { CONSENT_KEY, consentRecord, readConsent } from '../privacy.mjs';
import {useToast} from './toast-provider';
import {TbCookie} from 'react-icons/tb';

export default function StorageNotice() {
  const [visible,setVisible] = useState(false);
  const notify=useToast();
  useEffect(()=> {
    try { setVisible(!readConsent(localStorage.getItem(CONSENT_KEY))); }
    catch { setVisible(true); }
    const open = ()=>setVisible(true);
    window.addEventListener('tgcar:storage-settings',open);
    return ()=>window.removeEventListener('tgcar:storage-settings',open);
  },[]);
  function save() {
    try {
      localStorage.setItem(CONSENT_KEY,JSON.stringify(consentRecord()));
      notify({id:'storage',kind:'success',title:'Настройки сохранены',message:'Только необходимое хранилище. Аналитика и реклама выключены.'});
    } catch { notify({id:'storage',kind:'warning',title:'Не удалось запомнить выбор',message:'Хранилище браузера недоступно. Настройка действует до перезагрузки страницы.'}); }
    setVisible(false);
  }
  return <>{visible && <section className="storage-notice" role="region" aria-label="Cookies и персональные данные">
    <TbCookie className="cookie-icon" aria-hidden="true"/>
    <div>Используем кеш и необходимое хранилище для работы сайта. Без рекламных cookies. <a href="/cookies">Подробнее о cookies</a> · <a href="/privacy">Обработка данных</a></div>
    <button className="button" onClick={save}>Ок</button>
  </section>}</>;
}

export function StorageSettingsButton() {
  return <button className="text-button" onClick={()=>window.dispatchEvent(new Event('tgcar:storage-settings'))}>Настройки cookies</button>;
}
