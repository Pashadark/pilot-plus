'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FiCalendar, FiChevronRight, FiDownload, FiFileText, FiTool } from 'react-icons/fi';
import { Badge } from '@/shared/ui';
import type { VehicleMaintenanceHistorySummary as Visit, VehicleMaintenanceStatus } from '../types';

type Item = NonNullable<Visit['workItems']>[number];
const statuses: Record<
  VehicleMaintenanceStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'primary' | 'neutral' }
> = {
  COMPLETED: { label: 'Завершено', tone: 'success' },
  PLANNED: { label: 'Запланировано', tone: 'primary' },
  IN_PROGRESS: { label: 'В работе', tone: 'warning' },
  OVERDUE: { label: 'Просрочено', tone: 'danger' },
  CANCELLED: { label: 'Отменено', tone: 'neutral' },
  DAMAGE_REPORTED: { label: 'Повреждение', tone: 'danger' },
  WAITING_REPAIR: { label: 'Ожидает ремонта', tone: 'warning' },
};
const money = (value: number | null) =>
  value === null
    ? 'Не указана'
    : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value / 100)} ₽`;
const visitDate = (record: Visit) =>
  record.completedAt ?? record.startedAt ?? record.scheduledAt ?? record.damageReportedAt ?? null;
const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Moscow',
      })
        .format(new Date(value))
        .replace(/\s*г\.$/u, '')
    : 'Дата не указана';
const total = (items: Item[]) =>
  items.length && items.every((item) => item.costMinor !== null)
    ? items.reduce((sum, item) => sum + item.costMinor!, 0)
    : null;
const actionClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

function ItemsTable({ title, items }: { title: string; items: Item[] }) {
  if (!items.length) return null;
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="font-semibold">
          {title}{' '}
          <span className="ml-1 text-sm font-normal text-[var(--color-text-tertiary)]">
            {items.length}
          </span>
        </h4>
        <span className="text-sm font-semibold tabular-nums">{money(total(items))}</span>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-md)] border">
        <table aria-label={title} className="w-full table-fixed text-left text-sm">
          <thead className="bg-[var(--color-elevated)] text-xs text-[var(--color-text-secondary)]">
            <tr>
              <th className="p-3 font-medium">Наименование</th>
              <th className="hidden w-[32%] p-3 font-medium sm:table-cell">Количество / расчёт</th>
              <th className="w-28 p-3 text-right font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const detail = item.description
                ?.replace(/^(Работа|Материал):\s*/u, '')
                .replace(/; скидка 0\.?$/u, '');
              return (
                <tr key={item.id} className="border-t align-top">
                  <td className="p-3 leading-5 break-words">
                    {item.title}
                    {detail ? (
                      <span className="mt-1 block text-xs text-[var(--color-text-secondary)] sm:hidden">
                        {detail}
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden p-3 text-xs leading-5 break-words text-[var(--color-text-secondary)] sm:table-cell">
                    {detail || '—'}
                  </td>
                  <td className="p-3 text-right text-sm font-medium tabular-nums">
                    {money(item.costMinor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function VehicleMaintenanceWorkspace({
  vehicleId,
  records,
}: {
  vehicleId: string;
  records: Visit[];
}) {
  const sorted = [...records].sort(
    (a, b) => (Date.parse(visitDate(b) ?? '') || 0) - (Date.parse(visitDate(a) ?? '') || 0),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sorted.find((record) => record.id === selectedId) ?? sorted[0];
  const work =
    selected?.workItems?.filter((item) => /^Работа:/u.test(item.description ?? '')) ?? [];
  const parts =
    selected?.workItems?.filter((item) => /^Материал:/u.test(item.description ?? '')) ?? [];
  const other =
    selected?.workItems?.filter((item) => !/^(Работа|Материал):/u.test(item.description ?? '')) ??
    [];
  const documents =
    selected?.attachments?.filter((file) => file.kind === 'DOCUMENT' || file.kind === 'RECEIPT') ??
    [];
  const photos =
    selected?.attachments?.filter(
      (file) => file.kind === 'DAMAGE_BEFORE' || file.kind === 'REPAIR_AFTER',
    ) ?? [];
  const status = selected ? statuses[selected.status] : null;

  return (
    <div className="grid min-w-0 gap-5" data-testid="vehicle-maintenance-history">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ремонты и техническое обслуживание</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Даты, сервисы, работы и документы автомобиля
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={actionClass}
            href={`/maintenance?view=list&create=maintenance&vehicleId=${vehicleId}`}
          >
            Запланировать ТО
          </Link>
          <Link
            className={`${actionClass} border-transparent bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]`}
            href={`/maintenance?view=list&create=repair&vehicleId=${vehicleId}`}
          >
            <FiTool aria-hidden />
            Добавить ремонт
          </Link>
        </div>
      </header>
      {!selected ? (
        <div className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-8 text-center">
          <FiTool className="mx-auto mb-3 size-6 text-[var(--color-primary)]" aria-hidden />
          <h3 className="font-semibold">Обслуживание ещё не запланировано</h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Здесь будут регламенты, выполненные работы, даты и пробег.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            aria-label="История обслуживания"
            className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-sm font-semibold" aria-level={2}>
                История обслуживания
              </h3>
              <Badge tone="neutral">{records.length}</Badge>
            </div>
            <div className="max-h-64 overflow-y-auto p-2 lg:max-h-[680px]">
              {sorted.map((record, index) => {
                const date = visitDate(record);
                const month = date
                  ? new Intl.DateTimeFormat('ru-RU', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'Europe/Moscow',
                    }).format(new Date(date))
                  : 'Без даты';
                const previousDate = index ? visitDate(sorted[index - 1]) : null;
                const previousMonth = previousDate
                  ? new Intl.DateTimeFormat('ru-RU', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'Europe/Moscow',
                    }).format(new Date(previousDate))
                  : 'Без даты';
                return (
                  <div key={record.id}>
                    {index === 0 || month !== previousMonth ? (
                      <p className="px-3 pt-3 pb-2 text-xs font-medium text-[var(--color-text-tertiary)] capitalize">
                        {month}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      aria-pressed={selected.id === record.id}
                      aria-controls="maintenance-detail"
                      onClick={() => setSelectedId(record.id)}
                      className={`mb-1 w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${selected.id === record.id ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)]' : 'border-transparent hover:bg-[var(--color-elevated)]'}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
                        <span>{dateLabel(date)}</span>
                        <FiChevronRight className="shrink-0" aria-hidden />
                      </span>
                      <span className="mt-2 block text-sm leading-5 font-semibold">
                        {record.title}
                      </span>
                      <span className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <Badge tone={statuses[record.status].tone}>
                          {statuses[record.status].label}
                        </Badge>
                        <span className="text-sm font-semibold tabular-nums">
                          {money(record.costMinor)}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
          <article
            id="maintenance-detail"
            aria-label="Подробности обслуживания"
            className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
          >
            <header className="border-b p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <FiCalendar aria-hidden />
                  {dateLabel(visitDate(selected))}
                </span>
                {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                <Badge tone="neutral">{selected.recordType === 'REPAIR' ? 'Ремонт' : 'ТО'}</Badge>
              </div>
              <h3 className="text-xl leading-tight font-semibold sm:text-2xl">{selected.title}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-xs text-[var(--color-text-tertiary)]">Сервис / исполнитель</p>
                  <p className="mt-1 text-sm font-medium">{selected.provider || 'Не указан'}</p>
                  {selected.client || selected.rental ? (
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--color-primary)]">
                      {selected.client ? (
                        <Link href={`/clients/${selected.client.id}`}>
                          {selected.client.fullName}
                        </Link>
                      ) : null}
                      {selected.rental ? (
                        <Link href={`/rentals/${selected.rental.id}`}>
                          {selected.rental.contractNumber ?? 'Договор'}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Стоимость обслуживания
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {money(selected.costMinor)}
                  </p>
                </div>
              </div>
              {documents.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {documents.map((file, index) => (
                    <a
                      key={file.id}
                      href={`${file.url}?download=1`}
                      download
                      className={`${actionClass} border-[var(--color-primary)]/30 text-[var(--color-primary)]`}
                    >
                      <FiDownload aria-hidden />
                      {file.kind === 'RECEIPT' ? 'Скачать чек' : 'Скачать заказ-наряд'}
                      {documents.length > 1 ? ` · ${index + 1}` : ''}
                    </a>
                  ))}
                </div>
              ) : null}
            </header>
            <div className="grid min-w-0 gap-6 p-4 sm:p-6">
              <ItemsTable title="Работы" items={work} />
              <ItemsTable title="Запчасти и материалы" items={parts} />
              <ItemsTable title="Прочие позиции" items={other} />
              {!selected.workItems?.length ? (
                <p className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-4 text-sm text-[var(--color-text-secondary)]">
                  Состав работ не указан в записи.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-4">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <FiFileText className="text-[var(--color-primary)]" aria-hidden />
                  Итого по записи
                </span>
                <strong className="text-xl text-[var(--color-primary)] tabular-nums">
                  {money(selected.costMinor)}
                </strong>
              </div>
              {selected.description ? (
                <details key={selected.id} className="text-sm">
                  <summary className="cursor-pointer py-2 text-[var(--color-text-secondary)]">
                    Примечание к обслуживанию
                  </summary>
                  <p className="mt-2 leading-6 break-words whitespace-pre-line text-[var(--color-text-secondary)]">
                    {selected.description}
                  </p>
                </details>
              ) : null}
              {photos.length ? (
                <section>
                  <h4 className="mb-3 text-sm font-semibold">Фото повреждений и ремонта</h4>
                  <div className="grid gap-2">
                    {photos.map((file) => (
                      <div
                        key={file.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border p-3 text-sm"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 break-all text-[var(--color-primary)]"
                        >
                          {file.kind === 'DAMAGE_BEFORE' ? 'До ремонта' : 'После ремонта'} ·{' '}
                          {file.originalName}
                        </a>
                        <a className={actionClass} href={`${file.url}?download=1`} download>
                          <FiDownload aria-hidden />
                          Скачать
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
