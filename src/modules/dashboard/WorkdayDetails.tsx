import Link from 'next/link';
import { useState, useTransition } from 'react';
import { FiArrowRight, FiPhone } from 'react-icons/fi';
import { Badge } from '@/shared/ui';
import type { DashboardWorkItemDto } from './overview-types';
import { completeOperationsTaskAction } from './task-actions';

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
export function workdayMoney(value: string) {
  return money.format(Number(value) / 100);
}
const linkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

export function WorkdayDetails({ item }: { item: DashboardWorkItemDto }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rental = item.href.startsWith('/rentals/');
  const fields = [
    [item.kind === 'LEAD' ? 'Заявитель' : 'Автомобиль', item.vehicleLabel],
    [item.kind === 'LEAD' ? 'Источник' : 'Клиент', item.clientLabel ?? 'Не указан'],
    ['Договор', item.contractNumber ?? 'Не указан'],
    [
      'Период аренды',
      item.details?.startsAt && item.details?.endsAt
        ? `${date.format(new Date(item.details.startsAt))} — ${date.format(new Date(item.details.endsAt))}`
        : 'Нет данных',
    ],
  ];
  return (
    <section aria-label="Выбранная задача" className="min-w-0 p-4 sm:p-6">
      <p className="text-xs text-[var(--color-text-secondary)]">Выбранная задача</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
        <Badge tone={item.overdue ? 'danger' : item.tone}>
          {item.overdue ? 'Просрочено' : item.unscheduled ? 'Без срока' : 'Запланировано'}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {item.unscheduled
          ? 'Время не назначено'
          : `Срок: ${date.format(new Date(item.scheduledAt))}`}
      </p>
      {item.amountMinor !== null ? (
        <div className="mt-4 border-t pt-4">
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {workdayMoney(item.amountMinor)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {item.kind === 'DEPOSIT_RETURN' ? 'Депозит по договору' : 'Сумма'}
          </p>
        </div>
      ) : null}
      {item.kind === 'DEPOSIT_RETURN' ? (
        <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
          <dl className="grid grid-cols-3 gap-3 text-xs">
            {[
              [
                'Внесено',
                item.details?.collectedMinor ? workdayMoney(item.details.collectedMinor) : '—',
              ],
              ['Возвращено', '—'],
              ['Удержано', '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                <dd className="mt-1 font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Возврат и удержания проверяйте в расчётах договора.
          </p>
        </div>
      ) : null}
      <dl className="mt-4 grid grid-cols-1 gap-x-5 sm:grid-cols-2">
        {fields
          .filter(([label]) => rental || !['Договор', 'Период аренды'].includes(label))
          .map(([label, value]) => (
            <div key={label} className="min-w-0 border-b py-3">
              <dt className="text-xs text-[var(--color-text-secondary)]">{label}</dt>
              <dd className="mt-1 text-sm break-words">{value}</dd>
            </div>
          ))}
      </dl>
      <div className="border-b py-3">
        <p className="text-xs text-[var(--color-text-secondary)]">Телефон</p>
        {item.phone ? (
          <a
            href={`tel:${item.phone}`}
            className="mt-1 inline-flex min-h-8 items-center gap-2 text-sm text-[var(--color-primary)]"
          >
            <FiPhone aria-hidden="true" />
            {item.phone}
          </a>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Нет телефона</p>
        )}
      </div>
      {item.address ? <p className="mt-3 text-sm break-words">Адрес: {item.address}</p> : null}
      {item.details?.clientHref ? (
        <Link
          href={item.details.clientHref}
          className="mt-2 inline-flex min-h-10 items-center text-sm text-[var(--color-primary)]"
        >
          Карточка клиента <FiArrowRight className="ml-2" aria-hidden="true" />
        </Link>
      ) : null}
      <div className="mt-4">
        <h4 className="text-sm font-medium">История действий</h4>
        {item.details?.history.length ? (
          <ol className="mt-2 max-h-48 space-y-3 overflow-y-auto">
            {item.details.history.map((event) => (
              <li key={event.id} className="border-l-2 pl-3 text-sm">
                <p>{event.label}</p>
                <time dateTime={event.at} className="text-xs text-[var(--color-text-secondary)]">
                  {date.format(new Date(event.at))}
                </time>
                {event.notes ? (
                  <p className="mt-1 text-xs break-words whitespace-pre-wrap text-[var(--color-text-secondary)]">
                    {event.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3 text-xs text-[var(--color-text-secondary)]">
            Нет записанных действий
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={item.href}
          className={`${linkClass} flex-1 bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:opacity-90`}
        >
          {rental ? 'Открыть договор' : item.kind === 'LEAD' ? 'Открыть заявку' : 'Открыть'}
          <FiArrowRight aria-hidden="true" />
        </Link>
        {item.details?.vehicleHref ? (
          <Link
            href={item.details.vehicleHref}
            className={`${linkClass} text-[var(--color-primary)] hover:bg-[var(--color-elevated)]`}
          >
            Автомобиль
          </Link>
        ) : null}
      </div>
      {item.completable ? (
        <button
          disabled={pending}
          type="button"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const form = new FormData();
                form.set('taskId', item.id.replace('manual-task:', ''));
                await completeOperationsTaskAction(form);
              } catch {
                setError('Не удалось завершить задачу. Попробуйте ещё раз.');
              }
            });
          }}
          className={`${linkClass} mt-2 w-full bg-[var(--color-success)] text-white disabled:opacity-50`}
        >
          {pending ? 'Сохраняем…' : 'Отметить выполненной'}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
