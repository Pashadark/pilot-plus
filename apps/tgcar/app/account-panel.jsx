'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiFileText,
  FiLogOut,
  FiRefreshCw,
  FiShield,
  FiUpload,
  FiUser,
} from 'react-icons/fi';
import { useToast } from './toast-provider';

const STATUS = {
  DRAFT: ['Черновик', 'draft'],
  UNDER_REVIEW: ['На проверке', 'review'],
  NEEDS_CHANGES: ['Нужны исправления', 'warning'],
  REJECTED: ['Отклонена', 'danger'],
  AWAITING_PAYMENT: ['Одобрена · ожидает оплаты', 'success'],
  EXPIRED: ['Срок брони истёк', 'muted'],
};
const DOCUMENT_STATUS = {
  CLEAN: 'Проверен',
  QUARANTINED: 'На антивирусной проверке',
  BLOCKED: 'Заблокирован',
};
const EVENT = {
  CREATED: 'Заявка создана',
  DOCUMENT_UPLOADED: 'Документ добавлен',
  SUBMITTED: 'Отправлена на проверку',
  APPROVED: 'Одобрена менеджером',
  CHANGES_REQUESTED: 'Запрошены исправления',
  REJECTED: 'Заявка отклонена',
  EXPIRED: 'Локальная бронь истекла',
};
const date = (value) =>
  value
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : '—';
const money = (value) =>
  value == null ? 'Уточняется' : new Intl.NumberFormat('ru-RU').format(value) + ' ₽';

async function request(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
  return data;
}

function BrandHeader({ title, onLogout, pending }) {
  return (
    <header className="account-header">
      <Link href="/" className="account-brand" aria-label="TG CAR — на главную">
        <span>TG</span> CAR
      </Link>
      <div className="account-header-actions">
        <span className="account-title">{title}</span>
        <Link href="/" className="account-link">
          <FiArrowLeft /> Автопарк
        </Link>
        {onLogout && (
          <button className="account-link account-logout" onClick={onLogout} disabled={pending}>
            <FiLogOut /> Выйти
          </button>
        )}
      </div>
    </header>
  );
}

function Login({ mode, pending, onLogin, onRealLogin }) {
  const [phone, setPhone] = useState('');
  return (
    <main className="account-shell account-login-shell">
      <BrandHeader title={mode === 'manager' ? 'Проверка заявок' : 'Личный кабинет'} />
      <section className="login-card">
        <div className="eyebrow">
          <FiShield /> Локальный тестовый контур
        </div>
        <h1>{mode === 'manager' ? 'Панель проверки' : 'Вход в личный кабинет'}</h1>
        <p className="lead">
          Это синтетический доступ для проверки сценария. Он не подтверждает номер телефона и не
          открывает данные реальных клиентов.
        </p>
        {mode === 'client' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRealLogin(phone);
            }}
            className="phone-form"
          >
            <label>
              Телефон
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 999 000-00-00"
                autoComplete="tel"
                required
              />
            </label>
            <button className="account-button secondary" disabled={pending}>
              Продолжить с телефоном
            </button>
            <small>SMS-провайдер не подключён. Реальная регистрация сейчас недоступна.</small>
          </form>
        )}
        <div className="test-access">
          <strong>Тестовый доступ</strong>
          <p>Создаёт новый синтетический профиль только на этом локальном стенде.</p>
          <button className="account-button primary" onClick={onLogin} disabled={pending}>
            {pending ? (
              <>
                <FiRefreshCw className="spin" /> Входим…
              </>
            ) : (
              <>
                <FiUser />{' '}
                {mode === 'manager' ? 'Войти как тестовый менеджер' : 'Войти как тестовый клиент'}
              </>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}

function Notice() {
  return (
    <aside className="honesty-notice">
      <FiAlertCircle />
      <div>
        <strong>Только локальная демонстрация</strong>
        <p>
          SMS, подтверждение телефона, Telegram и платежи не подключены. Сообщения клиентам не
          отправляются, а показанные заявки и документы — синтетические тестовые данные.
        </p>
      </div>
    </aside>
  );
}

function StatusBadge({ status }) {
  const item = STATUS[status] || [status, 'muted'];
  return <span className={'status-badge ' + item[1]}>{item[0]}</span>;
}

function Documents({ application, pending, onUpload, onAction }) {
  const editable = ['DRAFT', 'NEEDS_CHANGES'].includes(application.status);
  const active = application.documents?.filter((item) => item.active) || [];
  return (
    <section className="application-section">
      <h3>Документы</h3>
      <div className="document-list">
        {['PASSPORT', 'LICENSE'].map((kind) => {
          const doc = active.find((item) => item.kind === kind);
          return (
            <div className="document-row" key={kind}>
              <FiFileText />
              <div>
                <strong>{kind === 'PASSPORT' ? 'Паспорт' : 'Водительское удостоверение'}</strong>
                <span>{doc ? doc.name : 'Не добавлен'}</span>
              </div>
              {doc && (
                <span className={'document-state ' + doc.status.toLowerCase()}>
                  {DOCUMENT_STATUS[doc.status] || doc.status}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {editable && (
        <>
          <form
            className="upload-form"
            onSubmit={(e) => {
              e.preventDefault();
              onUpload(application.id, new FormData(e.currentTarget));
              e.currentTarget.reset();
            }}
          >
            <label>
              Тип документа
              <select name="kind" defaultValue="PASSPORT">
                <option value="PASSPORT">Паспорт</option>
                <option value="LICENSE">Водительское удостоверение</option>
              </select>
            </label>
            <label>
              Файл JPG, PNG или PDF
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                required
              />
            </label>
            <button className="account-button secondary" disabled={pending}>
              <FiUpload /> Загрузить в карантин
            </button>
          </form>
          <p className="helper">
            Загруженный файл не считается проверенным, пока антивирус не присвоит статус «Проверен».
          </p>
          <div className="application-actions">
            <button
              className="account-button ghost"
              onClick={() => onAction(application.id, 'demo-documents')}
              disabled={pending}
            >
              Добавить синтетические метаданные документов
            </button>
            <button
              className="account-button primary"
              onClick={() => onAction(application.id, 'submit')}
              disabled={pending}
            >
              Отправить заявку на проверку
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Timeline({ items = [] }) {
  return (
    <ol className="timeline">
      {[...items].reverse().map((item) => (
        <li key={item.id}>
          <span />
          <div>
            <strong>{EVENT[item.type] || item.type}</strong>
            <time>{date(item.at)}</time>
            {item.note && <p>{item.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ApplicationCard({ application, pending, onUpload, onAction, reviewer = false }) {
  const [reason, setReason] = useState('');
  return (
    <article className="application-card">
      <div className="application-heading">
        <div>
          <span className="application-number">{application.number}</span>
          <h2>{application.vehicleName}</h2>
          <p>
            {application.start} {application.startTime} — {application.end} {application.endTime}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <div className="application-facts">
        <div>
          <span>Стоимость</span>
          <strong>{money(application.price)}</strong>
        </div>
        <div>
          <span>Залог</span>
          <strong>{money(application.deposit)}</strong>
        </div>
        {application.holdUntil && (
          <div>
            <span>Локальная бронь до</span>
            <strong>{date(application.holdUntil)}</strong>
          </div>
        )}
      </div>
      <Documents
        application={application}
        pending={pending}
        onUpload={onUpload}
        onAction={onAction}
      />
      {reviewer && application.status === 'UNDER_REVIEW' && (
        <section className="review-actions">
          <label>
            Комментарий для исправления или отказа
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              placeholder="Причина обязательна для исправлений и отказа"
            />
          </label>
          <div>
            <button
              className="account-button primary"
              onClick={() => onAction(application.id, 'approve')}
              disabled={pending}
            >
              <FiCheck /> Одобрить чистые документы
            </button>
            <button
              className="account-button secondary"
              onClick={() => onAction(application.id, 'changes', reason)}
              disabled={pending || !reason.trim()}
            >
              На исправление
            </button>
            <button
              className="account-button danger-button"
              onClick={() => onAction(application.id, 'reject', reason)}
              disabled={pending || !reason.trim()}
            >
              Отклонить
            </button>
          </div>
        </section>
      )}
      <details>
        <summary>История заявки</summary>
        <Timeline items={application.history} />
      </details>
    </article>
  );
}

function EmptySection({ title, children }) {
  return (
    <section className="empty-card">
      <FiClock />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </section>
  );
}

export default function AccountPanel({ mode }) {
  const manager = mode === 'manager',
    notify = useToast();
  const [data, setData] = useState(null),
    [auth, setAuth] = useState('loading'),
    [error, setError] = useState(''),
    [pending, setPending] = useState('');
  const endpoint = manager ? '/api/review' : '/api/account';
  const load = useCallback(
    async (silent = false) => {
      try {
        const result = await request(endpoint);
        setData(result);
        setAuth('ready');
        setError('');
      } catch (e) {
        if (e.message.includes('Войдите') || e.message.includes('вход менеджера')) setAuth('login');
        else {
          setError(e.message);
          if (!silent) notify({ kind: 'error', title: 'Не удалось обновить', message: e.message });
        }
      }
    },
    [endpoint, notify],
  );
  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);
  async function mutate(key, fn, success) {
    setPending(key);
    try {
      await fn();
      if (success) notify({ kind: 'success', title: success });
      await load(true);
    } catch (e) {
      notify({ kind: 'error', title: 'Действие не выполнено', message: e.message });
    } finally {
      setPending('');
    }
  }
  const login = () =>
    mutate(
      'login',
      () =>
        request('/api/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'demo-login', role: manager ? 'manager' : 'client' }),
        }),
      'Тестовый доступ открыт',
    );
  const realLogin = (phone) =>
    mutate('real-login', () =>
      request('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'real-login', phone }),
      }),
    );
  const logout = () =>
    mutate(
      'logout',
      () =>
        request('/api/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout' }),
        }),
      'Сеанс завершён',
    );
  const action = (id, name, reason) =>
    mutate(
      id + name,
      () =>
        request(`/api/applications/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: name, reason }),
        }),
      name === 'submit' ? 'Заявка отправлена' : 'Статус заявки обновлён',
    );
  const upload = (id, body) =>
    mutate(
      id + 'upload',
      () => request(`/api/applications/${id}/documents`, { method: 'POST', body }),
      'Документ принят в карантин',
    );
  if (auth === 'loading')
    return (
      <main className="account-shell">
        <BrandHeader title={manager ? 'Проверка заявок' : 'Личный кабинет'} />
        <div className="account-skeleton" aria-label="Загрузка">
          <i />
          <i />
          <i />
        </div>
      </main>
    );
  if (auth === 'login')
    return <Login mode={mode} pending={Boolean(pending)} onLogin={login} onRealLogin={realLogin} />;
  const applications = data?.applications || [];
  return (
    <main className="account-shell">
      <BrandHeader
        title={manager ? 'Проверка заявок' : data?.user?.name || 'Личный кабинет'}
        onLogout={logout}
        pending={Boolean(pending)}
      />
      <div className="account-content">
        <Notice />
        {error && (
          <div className="inline-error" role="alert">
            {error}
            <button onClick={() => load()}>Повторить</button>
          </div>
        )}
        <div className="page-intro">
          <div>
            <span className="eyebrow">{manager ? 'Рабочее место менеджера' : 'Ваши заявки'}</span>
            <h1>{manager ? 'Локальная проверка документов' : 'Личный кабинет'}</h1>
            <p>
              {manager
                ? 'Одобрение доступно только для документов со статусом «Проверен».'
                : 'Статусы обновляются автоматически каждые 15 секунд.'}
            </p>
          </div>
          <button className="refresh-button" onClick={() => load()} disabled={Boolean(pending)}>
            <FiRefreshCw /> Обновить
          </button>
        </div>
        <section className="applications">
          <h2>
            {manager ? 'Заявки на проверку' : 'Заявки на аренду'} <span>{applications.length}</span>
          </h2>
          {applications.length ? (
            applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                reviewer={manager}
                pending={Boolean(pending)}
                onUpload={upload}
                onAction={action}
              />
            ))
          ) : (
            <div className="empty-applications">
              <FiFileText />
              <h3>Заявок пока нет</h3>
              <p>
                {manager
                  ? 'Новые синтетические заявки появятся здесь после отправки клиентом.'
                  : 'Выберите автомобиль в каталоге и создайте тестовую заявку.'}
              </p>
              <Link href="/" className="account-button primary">
                Перейти в автопарк
              </Link>
            </div>
          )}
        </section>
        {manager ? (
          <section className="outbox">
            <h2>Локальная очередь уведомлений</h2>
            <p>
              Доставка не настроена: записи ниже не означают, что Telegram-сообщение отправлено.
            </p>
            {(data?.outbox || []).map((item) => (
              <div key={item.id}>
                <span>{item.type}</span>
                <strong>Не доставлено · интеграция не настроена</strong>
                <time>{date(item.createdAt)}</time>
              </div>
            ))}
            {!(data?.outbox || []).length && <small>Очередь пуста.</small>}
          </section>
        ) : (
          <div className="account-grid">
            <EmptySection title="Аренды">
              Активных аренд нет. Источник реальных клиентских данных не подключён.
            </EmptySection>
            <EmptySection title="Штрафы">
              Данных о штрафах нет. Самостоятельная оплата здесь недоступна.
            </EmptySection>
            <EmptySection title="Платежи">
              Платёжный провайдер не подключён, подтверждений оплаты нет.
            </EmptySection>
            <EmptySection title="Telegram и напоминания">
              Telegram не подключён. Напоминания за 24 и 3 часа до возврата запланированы, но сейчас
              не отправляются.
            </EmptySection>
          </div>
        )}
      </div>
    </main>
  );
}
