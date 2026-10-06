'use client';
import {useEffect,useState} from 'react';
export default function CustomerPanel(){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/customer',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Не удалось загрузить профиль. Обновите страницу.');setUser((await r.json()).user);}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 async function submit(e){e.preventDefault();const f=new FormData(e.currentTarget);await act({action:register?'register':'login',name:f.get('name'),phone:f.get('phone'),password:f.get('password'),consent:f.get('consent')==='on'});}
 async function act(body){setBusy(true);setError('');try{const r=await fetch('/api/customer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);setUser(d.user);}catch(e){setError(e.message||'Ошибка связи. Повторите попытку.');}finally{setBusy(false);}}
 return <main className="customer-page wrap"><a href="/" className="brand">TG <b>CAR</b></a><section className="customer-card">
 {loading?<div className="customer-skeleton" aria-label="Загрузка профиля"><i/><i/><i/></div>:user?<>
 <span className="eyebrow">Личный кабинет</span><h1>{user.name}</h1><p>+{user.phone}</p><span className="availability-badge pending">Телефон не подтверждён</span>
 <p>Ваш профиль создан. Договоры и документы не привязываются автоматически по номеру телефона.</p>
 <a className="button" href="/#fleet">Выбрать автомобиль</a><button className="text-button customer-logout" onClick={()=>act({action:'logout'})} disabled={busy}>Выйти из профиля</button>
 </>:<><h1>{register?'Создать профиль':'Вход в личный кабинет'}</h1><p>{register?'Укажите имя, телефон и придумайте пароль.':'Введите телефон и пароль от вашего профиля.'}</p>
 <form onSubmit={submit} className="customer-form">
 {register&&<label>Имя и фамилия<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>}
 <label>Телефон<input name="phone" type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" required maxLength={24}/></label>
 <label>Пароль<input name="password" type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?10:1} maxLength={128}/></label>
 {register&&<><small>От 10 символов. Сохраните пароль: автоматическое восстановление пока недоступно.</small><label className="customer-consent"><input name="consent" type="checkbox" required/><span>Даю <a href="/consent" target="_blank" rel="noreferrer">согласие на обработку персональных данных</a> для регистрации и работы личного кабинета. <a href="/privacy" target="_blank" rel="noreferrer">Политика обработки данных</a>.</span></label></>}
 <button className="button wide" disabled={busy}>{busy?'Подождите…':register?'Зарегистрироваться':'Войти'}</button></form>
 <button className="text-button" onClick={()=>{setRegister(!register);setError('');}} disabled={busy}>{register?'Уже есть профиль? Войти':'Нет профиля? Зарегистрироваться'}</button></>}
 {error&&<p role="alert" className="customer-error">{error}</p>}
 </section><a href="/">← Вернуться в автопарк</a></main>;
}
