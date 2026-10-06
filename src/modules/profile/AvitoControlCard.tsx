'use client';
import { useState, useTransition } from 'react';
import type { AvitoControl } from '@/modules/leads/avito/control';
import { Card } from '@/shared/ui';
import { updateAvitoProfileControl } from './avito-actions';

export function AvitoControlCard({ initial }: { initial: AvitoControl }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <svg viewBox="0 0 48 48" role="img" aria-label="Авито" className="size-10 shrink-0">
            <circle cx="13" cy="13" r="9" fill="#ff4053" />
            <circle cx="35" cy="16" r="12" fill="#00aaff" />
            <circle cx="14" cy="35" r="12" fill="#97cf26" />
            <circle cx="36" cy="37" r="8" fill="#a169f7" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold">Авито</h3>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Автоответчик по аренде автомобилей
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Автоответчик Авито"
          aria-checked={state.enabled}
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            setError('');
            startTransition(async () => {
              try {
                const result = await updateAvitoProfileControl(!state.enabled);
                if (result.ok) setState(result.state);
                else setError(result.message);
              } catch {
                setError('Нет связи с сервером. Настройка не подтверждена.');
              }
            });
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-wait disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            data-testid="avito-switch-track"
            className={`relative block h-6 w-11 rounded-full border border-[var(--color-border-strong)] shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition-colors ${state.enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-elevated)]'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-[18px] rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200 motion-reduce:transition-none ${state.enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </span>
        </button>
      </div>
      <p role="status" className="mt-3 text-sm font-medium">
        {pending ? 'Сохраняем…' : state.enabled ? 'Автоответы включены' : 'Автоответы выключены'}
      </p>
      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <h4 className="text-sm font-semibold">Что делает бот</h4>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          <li>Уточняет автомобиль, даты и время аренды, общий пробег и телефон.</li>
          <li>Предлагает подходящие машины с учётом расписания аренды.</li>
          <li>Передаёт собранную заявку в СУПА ПРО — дальше работает менеджер.</li>
        </ul>
        <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--color-elevated)] px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)]">
          Только обращения по аренде. Объявления о продаже не обрабатывает, бронь и оплату не
          подтверждает.
        </p>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        {state.enabled
          ? 'Бот отвечает только на новые обращения по аренде.'
          : 'Бот не отвечает клиентам. Приём заявок не отключается.'}{' '}
        Старые переписки не возобновляются.
      </p>
      {state.updatedAt && (
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          Изменено:{' '}
          {new Intl.DateTimeFormat('ru-RU', {
            timeZone: 'Europe/Moscow',
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(state.updatedAt))}{' '}
          МСК
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
        Сообщение, уже переданное Авито, отозвать нельзя.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </Card>
  );
}
