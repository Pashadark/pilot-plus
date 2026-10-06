'use client';
import { useRef, useState } from 'react';
import { useToast } from './toast-provider';
import {leadComment} from '../lead-comment.mjs';
export default function ClientForm({ vehicle, start, end, startTime, endTime }) {
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [created, setCreated] = useState(null);
  const attempt = useRef(null);
  const notify = useToast();
  async function submit(event) {
    event.preventDefault();
    if (busy || created) return;
    if (!consent) {setStatus('Чтобы отправить заявку, отметьте согласие на обработку персональных данных.');return;}
    const form = new FormData(event.currentTarget);
    const data = {
      vehicleId: vehicle.id,
      start,
      end,
      startTime,
      endTime,
      name: String(form.get('name') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      comment: leadComment(form.get('deliveryAddress'),form.get('comment')),
      consent,
    };
    const fingerprint = JSON.stringify(data);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true);
    setStatus('Передаём заявку в СУПА ПРО…');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, requestId: attempt.current.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось отправить заявку.');
      setCreated(result);
      setStatus(
        'Заявка получена. Менеджер свяжется с вами для проверки условий. Это ещё не подтверждённая бронь.',
      );
      notify({
        kind: 'success',
        title: 'Заявка получена',
        message: 'Обращение сохранено в СУПА ПРО. Ожидайте связи с менеджером.',
      });
    } catch (error) {
      setStatus(error.message || 'Нет связи. Повторите отправку.');
      notify({
        kind: 'error',
        title: 'Отправка не подтверждена',
        message: 'Повторите попытку. Повторное нажатие не создаст дубликат.',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="client-form" onSubmit={submit}>
      <h3>Заявка на аренду</h3>
      <p>
        Укажите контакты — менеджер проверит автомобиль и условия. Отправка заявки не резервирует
        машину и не требует оплаты.
      </p>
      <fieldset
        disabled={busy || !!created}
        style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 16 }}
      >
        <label>
          Имя и фамилия *
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={150}
            placeholder="Как к вам обращаться"
          />
        </label>
        <label>
          Телефон *
          <input
            name="phone"
            autoComplete="tel"
            type="tel"
            inputMode="tel"
            aria-required="true"
            required
            maxLength={30}
            placeholder="+7 (___) ___-__-__"
          />
        </label>
        <small>
          * Обязательные поля. Телефон нужен, чтобы подтвердить условия аренды.
        </small>
        <label>
          Адрес подачи <span className="optional">Необязательно</span>
          <input name="deliveryAddress" autoComplete="off" maxLength={250} placeholder="Улица, дом — если нужна подача автомобиля"/>
          <small>Возможность и стоимость подачи согласуем с вами. Можно забрать автомобиль в офисе.</small>
        </label>
        <label>
          Комментарий <span className="optional">Необязательно</span>
          <textarea name="comment" rows={3} maxLength={650} placeholder="Пожелания к аренде" />
        </label>
        <div className="personal-consent">
          <input
            id="application-consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          <label htmlFor="application-consent">
            Даю <a href="/consent" target="_blank" rel="noreferrer">согласие на обработку персональных данных</a> для рассмотрения заявки и связи со мной в соответствии с <a href="/privacy" target="_blank" rel="noreferrer">политикой обработки данных</a>.
          </label>
        </div>
        <button type="submit" className="button wide" disabled={busy || !!created}>
          {busy ? 'Отправляем…' : created ? 'Заявка получена' : 'Отправить заявку'}
        </button>
      </fieldset>
      <p role="status">{status}</p>
      {created && <small>Номер обращения: {created.id}</small>}
    </form>
  );
}
