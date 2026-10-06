'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiServer, FiActivity, FiRefreshCw, FiLock, FiClock } from 'react-icons/fi';
import type { MonitorSnapshot, MonitorState } from './monitor-model';

const labels: Record<MonitorState, string> = {
  healthy: 'Работает',
  degraded: 'Внимание',
  unavailable: 'Сбой',
  unknown: 'Нет подтверждения',
  disabled: 'Отключено',
};
const tones: Record<MonitorState, string> = {
  healthy: 'text-[var(--color-success)] bg-[var(--color-success-soft)]',
  degraded: 'text-[var(--color-warning)] bg-[var(--color-warning-soft)]',
  unavailable: 'text-[var(--color-danger)] bg-[var(--color-danger-soft)]',
  unknown: 'text-[var(--color-text-secondary)] bg-[var(--color-elevated)]',
  disabled: 'text-[var(--color-text-secondary)] bg-[var(--color-elevated)]',
};
const time = (value: string) =>
  new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

export function MonitorDashboard() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [filter, setFilter] = useState<MonitorState | 'all'>('all');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<
    { at: string; label: string; message: string; status: MonitorState }[]
  >([]);
  const previous = useRef<MonitorSnapshot | null>(null);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/system/monitor', {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('Unavailable');
      const next: MonitorSnapshot = await response.json();
      const changes = next.cards
        .filter(
          (card) =>
            previous.current &&
            previous.current.cards.find((old) => old.key === card.key)?.status !== card.status,
        )
        .map((card) => ({
          at: next.checkedAt,
          label: card.label,
          message: card.message,
          status: card.status,
        }));
      if (changes.length) setHistory((old) => [...changes, ...old].slice(0, 50));
      previous.current = next;
      setSnapshot(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const cards = snapshot?.cards ?? [];
  return (
    <section className="min-w-0 space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Состояние системы</h1>
            <span className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
              <FiLock /> Только SUPER_ADMIN
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Ресурсы серверов, фоновые процессы и интеграции
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={() => void refresh()}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <FiRefreshCw />
            {busy ? 'Проверяем…' : 'Проверить сейчас'}
          </button>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {snapshot ? time(snapshot.checkedAt) : 'Получаем данные'} · каждые 15 с
          </p>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]"
        >
          Не удалось обновить проверку. Показания ниже устарели — текущая работоспособность не
          подтверждена.
        </p>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Фильтр состояния">
        {(['all', 'healthy', 'degraded', 'unavailable', 'unknown'] as const).map((value) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-10 rounded-xl border px-3 text-sm ${filter === value ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface)]'}`}
          >
            {value === 'all' ? 'Все' : labels[value]}{' '}
            <span className="ml-2 tabular-nums">
              {cards.filter((card) => value === 'all' || card.status === value).length}
            </span>
          </button>
        ))}
      </div>
      {!snapshot && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Загрузка мониторинга">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-[var(--radius-panel)] border bg-[var(--color-surface)] motion-reduce:animate-none"
            />
          ))}
        </div>
      )}
      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards
          .filter((card) => filter === 'all' || card.status === filter)
          .map((card) => (
            <article
              key={card.key}
              className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="flex gap-3">
                  <FiServer className="mt-0.5 size-5 shrink-0 text-[var(--color-primary)]" />
                  <h2 className="font-semibold">{card.label}</h2>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${tones[error ? 'unknown' : card.status]}`}
                >
                  {error ? 'Устарело' : labels[card.status]}
                </span>
              </div>
              <dl className="px-5">
                {card.metrics.map((metric) => (
                  <div key={metric.label} className="border-t py-3">
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <dt className="text-[var(--color-text-secondary)]">{metric.label}</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {metric.value}
                        {metric.percent !== undefined && metric.value !== `${metric.percent}%`
                          ? ` · ${metric.percent}%`
                          : ''}
                      </dd>
                    </div>
                    {metric.percent !== undefined && (
                      <div
                        role="progressbar"
                        aria-label={metric.label}
                        aria-valuenow={metric.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${metric.percent}%`,
                            background:
                              metric.percent >= 80
                                ? 'var(--color-warning)'
                                : 'var(--color-primary)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </dl>
              <p className="mx-5 mb-4 rounded-xl bg-[var(--color-elevated)] p-3 text-sm leading-5 text-[var(--color-text-secondary)]">
                {card.message}
              </p>
              <footer className="mt-auto flex items-center gap-2 border-t px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                <FiClock />
                Проверено {time(card.checkedAt)}
              </footer>
            </article>
          ))}
      </div>
      <section className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <FiActivity /> Изменения состояния
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          За время открытия страницы. История сбрасывается при перезагрузке.
        </p>
        <div className="mt-4 space-y-3">
          {history.length ? (
            history.map((event, i) => (
              <div
                key={`${event.at}-${i}`}
                className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-[160px_180px_1fr]"
              >
                <time>{time(event.at)}</time>
                <strong>{event.label}</strong>
                <p>
                  {labels[event.status]} — {event.message}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Изменений с начала наблюдения нет.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
