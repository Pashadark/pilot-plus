'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  FiAlertCircle,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiMessageCircle,
  FiPhone,
  FiTool,
} from 'react-icons/fi';
import { Badge, Modal } from '@/shared/ui';
import type { DashboardWorkItemDto } from './overview-types';
import { groupWorkdayItems } from './workday-groups';
import { WorkdayDetails, workdayMoney } from './WorkdayDetails';

const clock = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
});
const date = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
});
const headingDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});
const filters = [
  ['all', 'Все'],
  ['cars', 'Выдачи и возвраты'],
  ['fines', 'Штрафы'],
  ['deposits', 'Депозиты'],
  ['leads', 'Заявки'],
] as const;
const actionLink =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-center text-sm font-semibold text-[var(--color-text-inverse)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

function presentation(item: DashboardWorkItemDto) {
  if (['HANDOVER', 'DELIVERY'].includes(item.kind))
    return { title: 'Выдать автомобиль', label: 'Выдача', Icon: FiArrowUpRight, color: 'primary' };
  if (['RETURN', 'RENTAL_END'].includes(item.kind))
    return {
      title: 'Принять автомобиль',
      label: 'Возврат',
      Icon: FiArrowDownLeft,
      color: 'success',
    };
  if (item.kind === 'DEPOSIT_RETURN')
    return { title: 'Вернуть депозит', label: 'Депозит', Icon: FiCreditCard, color: 'success' };
  if (item.kind === 'FINE')
    return { title: 'Оплатить штраф', label: 'Штраф', Icon: FiFileText, color: 'warning' };
  if (item.kind === 'LEAD')
    return {
      title: 'Связаться по заявке',
      label: 'Заявка',
      Icon: FiMessageCircle,
      color: 'primary',
    };
  return {
    title: item.title,
    label: item.kind === 'MAINTENANCE' ? 'Обслуживание' : 'Задача',
    Icon: FiTool,
    color: 'primary',
  };
}
function action(item: DashboardWorkItemDto) {
  return ['HANDOVER', 'DELIVERY', 'RETURN', 'RENTAL_END', 'DEPOSIT_RETURN', 'FINE'].includes(
    item.kind,
  )
    ? presentation(item).title
    : item.kind === 'LEAD'
      ? 'Открыть заявку'
      : 'Открыть задачу';
}
function vehicleParts(label: string) {
  const parts = label.split(/\s*·\s*/);
  const index = parts.findIndex((part) =>
    /^[А-ЯA-Z]\d{3}[А-ЯA-Z]{2}\d{2,3}$/i.test(part.replace(/\s/g, '')),
  );
  const plate = index >= 0 ? parts.splice(index, 1)[0] : null;
  return { name: parts.join(' '), plate };
}
function TaskTime({ item }: { item: DashboardWorkItemDto }) {
  if (item.kind === 'FINE' && item.deadlineLabel === 'Срок оплаты не указан')
    return (
      <span className="text-sm text-[var(--color-text-secondary)]">Срок оплаты не указан</span>
    );
  if (item.unscheduled)
    return <span className="text-sm text-[var(--color-text-secondary)]">Без срока</span>;
  return (
    <time dateTime={item.scheduledAt} className="block whitespace-nowrap tabular-nums">
      <span className="block text-sm">{date.format(new Date(item.scheduledAt))}</span>
      <span className="mt-1 flex items-center gap-1.5 font-semibold">
        {item.dateOnly ? (
          'До конца дня'
        ) : (
          <>
            <FiClock aria-hidden="true" className="size-4" />
            {clock.format(new Date(item.scheduledAt))}
          </>
        )}
      </span>
    </time>
  );
}

export function WorkdayBoard({ items, now }: { items: DashboardWorkItemDto[]; now?: string }) {
  const [initialNow] = useState(() => new Date().toISOString());
  const anchor = now ?? initialNow;
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = items.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'cars'
        ? ['HANDOVER', 'DELIVERY', 'RETURN', 'RENTAL_END'].includes(item.kind)
        : filter === 'fines'
          ? item.kind === 'FINE'
          : filter === 'deposits'
            ? item.kind === 'DEPOSIT_RETURN'
            : item.kind === 'LEAD'),
  );
  const grouped = groupWorkdayItems(filtered, anchor);
  const urgentCandidates = [
    ...grouped.overdue,
    ...grouped.today.filter((item) => item.kind === 'DEPOSIT_RETURN' || item.kind === 'FINE'),
  ];
  const urgent: DashboardWorkItemDto[] = [];
  // Reserve the compact priority row for distinct operations, then fill any gaps.
  for (const kinds of [['RETURN', 'RENTAL_END'], ['FINE'], ['DEPOSIT_RETURN']]) {
    const candidate = urgentCandidates.find((item) => kinds.includes(item.kind));
    if (candidate) urgent.push(candidate);
  }
  for (const item of urgentCandidates) {
    if (urgent.length >= 3) break;
    if (!urgent.some((candidate) => candidate.id === item.id)) urgent.push(item);
  }
  const urgentIds = new Set(urgent.map((item) => item.id));
  const today = [...grouped.overdue, ...grouped.today].filter((item) => !urgentIds.has(item.id));
  const selected = filtered.find((item) => item.id === selectedId);

  function table(label: string, entries: DashboardWorkItemDto[], quiet = false) {
    return (
      <section aria-label={label} className="min-w-0">
        <h3 className="mb-3 flex items-center gap-3 text-xl font-semibold">
          {label}
          <span className="text-sm font-normal text-[var(--color-text-secondary)]">
            {entries.length}
          </span>
        </h3>
        {!entries.length ? (
          <p className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">
            Нет задач
          </p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-surface)]">
            <div
              className="hidden grid-cols-[85px_1.3fr_1fr_1.2fr_1fr_150px] gap-4 bg-[var(--color-elevated)] px-5 py-3 text-xs font-medium text-[var(--color-text-secondary)] xl:grid"
              aria-hidden="true"
            >
              <span>Время</span>
              <span>Действие</span>
              <span>Автомобиль</span>
              <span>Клиент</span>
              <span>Сумма / срок</span>
              <span>Действие</span>
            </div>
            <ul className="divide-y">
              {entries.map((item) => {
                const p = presentation(item);
                const vehicle = vehicleParts(item.vehicleLabel);
                return (
                  <li
                    key={item.id}
                    className={`grid grid-cols-[75px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 xl:grid-cols-[85px_1.3fr_1fr_1.2fr_1fr_150px] ${quiet ? 'text-[var(--color-text-secondary)]' : ''}`}
                  >
                    <TaskTime item={item} />
                    <button
                      type="button"
                      aria-label={`${p.title} ${item.vehicleLabel}`}
                      onClick={() => setSelectedId(item.id)}
                      className="flex min-h-11 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full"
                        style={{
                          backgroundColor: `var(--color-${p.color}-soft)`,
                          color: `var(--color-${p.color})`,
                        }}
                      >
                        <p.Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{p.title}</span>
                        <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                          {item.overdue ? (
                            <span className="font-semibold text-[var(--color-danger)]">
                              Просрочено
                            </span>
                          ) : (
                            p.label
                          )}
                        </span>
                      </span>
                    </button>
                    <div className="col-start-2 min-w-0 text-sm xl:col-auto">
                      <span className="block font-medium">{vehicle.name}</span>
                      {vehicle.plate && (
                        <span className="mt-1 inline-block rounded bg-[var(--color-elevated)] px-2 py-0.5 text-xs font-semibold">
                          {vehicle.plate}
                        </span>
                      )}
                    </div>
                    <div className="col-start-2 min-w-0 text-sm xl:col-auto">
                      <span>{item.clientLabel ?? 'Не указан'}</span>
                      {item.phone && (
                        <a
                          href={`tel:${item.phone}`}
                          className="mt-1 flex min-h-7 items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
                        >
                          <FiPhone aria-hidden="true" />
                          {item.phone}
                        </a>
                      )}
                    </div>
                    <div className="col-start-2 min-w-0 xl:col-auto">
                      <span className="block text-sm font-semibold tabular-nums">
                        {item.amountMinor !== null ? workdayMoney(item.amountMinor) : '—'}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                        {item.deadlineLabel ??
                          (item.kind === 'DEPOSIT_RETURN'
                            ? 'Возврат депозита'
                            : item.amountMinor !== null
                              ? 'Сумма по задаче'
                              : item.unscheduled
                                ? 'Без срока'
                                : label === 'Завтра'
                                  ? 'Завтра'
                                  : 'Сегодня')}
                      </span>
                    </div>
                    <Link
                      href={item.href}
                      className={`${actionLink} col-span-2 xl:col-auto ${quiet ? '!border !bg-transparent !text-[var(--color-primary)]' : ''}`}
                    >
                      {action(item)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="workday-heading"
      className="min-w-0 space-y-6"
      data-testid="workday-priorities"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="workday-heading" className="text-2xl font-bold tracking-tight">
            Рабочий день
          </h2>
          <p className="mt-1 text-base text-[var(--color-text-secondary)] capitalize">
            {headingDate.format(new Date(anchor))}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Приоритеты менеджера</p>
        </div>
        <Badge tone={grouped.overdue.length ? 'danger' : 'info'}>{filtered.length} действий</Badge>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="Фильтр задач">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key);
              setSelectedId(null);
            }}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${filter === key ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <section aria-label="Сделать сейчас">
        <h3 className="mb-3 flex items-center gap-3 text-xl font-semibold">
          Сделать сейчас
          <span className="text-sm font-normal text-[var(--color-text-secondary)]">
            {urgent.length}
          </span>
        </h3>
        {!urgent.length ? (
          <p className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">
            Срочных задач нет
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {urgent.map((item) => {
              const p = presentation(item);
              const vehicle = vehicleParts(item.vehicleLabel);
              const color = item.overdue ? 'danger' : p.color;
              return (
                <article
                  key={item.id}
                  className="flex min-w-0 flex-col rounded-[var(--radius-panel)] border p-5"
                  style={{
                    backgroundColor: `var(--color-${color}-soft)`,
                    borderColor: `color-mix(in srgb, var(--color-${color}) 22%, var(--color-border))`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--color-surface)]"
                      style={{ color: `var(--color-${color})` }}
                    >
                      {item.overdue ? (
                        <FiAlertCircle className="size-6" aria-hidden="true" />
                      ) : (
                        <p.Icon className="size-6" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: `var(--color-${color})` }}>
                        {item.overdue
                          ? 'Просрочено'
                          : (item.deadlineLabel ?? (item.kind === 'FINE' ? item.title : 'Сегодня'))}
                      </p>
                      <h4 className="mt-1 text-lg font-bold">{p.title}</h4>
                      {item.amountMinor !== null && (
                        <p className="mt-1 text-2xl font-bold tabular-nums">
                          {workdayMoney(item.amountMinor)}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-medium">{vehicle.name}</p>
                      {vehicle.plate && (
                        <p className="mt-1 text-sm font-semibold">{vehicle.plate}</p>
                      )}
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {item.clientLabel ?? 'Клиент не указан'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
                    <TaskTime item={item} />
                    <Link href={item.href} className={actionLink}>
                      {action(item)}
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-label={`${p.title} ${item.vehicleLabel}`}
                    className="mt-3 min-h-8 self-start text-sm text-[var(--color-text-secondary)] underline decoration-dotted underline-offset-4 focus-visible:outline-2"
                  >
                    Информация о задаче
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {table('Далее сегодня', today)}
      {table('Завтра', grouped.tomorrow, true)}
      {grouped.otherTotal > 0 && (
        <div>
          {table('Остальные уведомления', grouped.other, true)}
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Показано {grouped.other.length} из {grouped.otherTotal}. До 20 уведомлений.
          </p>
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title="Информация о задаче"
        className="max-h-[85dvh] overflow-y-auto"
        backdropClassName="z-[120]"
      >
        {selected && <WorkdayDetails key={selected.id} item={selected} />}
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="mt-3 min-h-11 rounded border px-4 text-sm"
        >
          Закрыть
        </button>
      </Modal>
    </section>
  );
}
