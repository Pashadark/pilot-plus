import Link from 'next/link';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiFilter,
  FiPlusCircle,
  FiSearch,
} from 'react-icons/fi';

import { presentRentalListRow, type RentalListSource } from './rental-list-presentation';
import { RentalRowActionsMenu } from './RentalRowActionsMenu';

type Filters = {
  query?: string;
  status?: string;
  vehicleId?: string;
  from?: string;
  to?: string;
  archive?: string;
};

const statusOptions = [
  ['ACTIVE', 'Действуют'],
  ['CONFIRMED', 'Бронирования'],
  ['COMPLETED', 'Закрыты'],
  ['DRAFT', 'Черновики'],
  ['CANCELLED', 'Отменены'],
] as const;

const rowAccent = {
  overdue: 'bg-[var(--color-danger)]',
  today: 'bg-amber-400',
  soon: 'bg-amber-400',
  normal: 'bg-emerald-500',
  closed: 'bg-slate-300',
} as const;

const statusTone = {
  danger: 'bg-rose-50 text-rose-700',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
} as const;

const actionLabels = {
  CONTINUE: 'Продолжить',
  HANDOVER: 'Выдать',
  EXTEND: 'Продлить',
  OPEN: 'Подробнее',
} as const;

function queryString(filters: Filters, extra: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/rentals?${query}` : '/rentals';
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function actionHref(row: ReturnType<typeof presentRentalListRow>) {
  if (row.primaryAction === 'CONTINUE') return `/rentals/${row.id}/edit`;
  if (row.primaryAction === 'HANDOVER') return `/rentals/${row.id}#rental-actions`;
  if (row.primaryAction === 'EXTEND') return `/rentals/${row.id}?action=extend#rental-actions`;
  return `/rentals/${row.id}`;
}

function CompactActiveActions({
  row,
  mobile = false,
}: {
  row: ReturnType<typeof presentRentalListRow>;
  mobile?: boolean;
}) {
  const size = mobile ? 'min-h-10 px-3 text-sm' : 'min-h-8 px-2 text-xs';

  return (
    <div
      data-testid={mobile ? 'rental-compact-actions-mobile' : 'rental-compact-actions'}
      className={`flex flex-col gap-1.5 ${mobile ? 'w-28' : 'w-24'}`}
    >
      <Link
        href={`/rentals/${row.id}?action=extend#rental-actions`}
        className={`inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-primary)] bg-[var(--color-surface)] font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${size}`}
      >
        Продлить
      </Link>
      <Link
        href={`/rentals/${row.id}?action=return#rental-actions`}
        className={`inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)] font-semibold text-[var(--color-text-inverse)] transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${size}`}
      >
        Завершить
      </Link>
    </div>
  );
}

function PaymentCell({ row }: { row: ReturnType<typeof presentRentalListRow> }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold whitespace-nowrap text-[var(--color-text)] tabular-nums">
        {row.total}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)] tabular-nums">
        {row.dailyRate}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-emerald-700">
        {row.paymentLabel} {row.paymentPercent}%
      </p>
    </div>
  );
}

export function RentalListPage({
  rentals,
  filters = {},
  now = new Date().toISOString(),
}: {
  rentals: readonly RentalListSource[];
  filters?: Filters;
  now?: string;
}) {
  const rows = rentals
    .map((rental) => presentRentalListRow(rental, new Date(now)))
    .sort((a, b) => a.priority - b.priority || a.endsAt.localeCompare(b.endsAt));
  const activeCount = rows.filter((row) => ['ACTIVE', 'EXTENDED'].includes(row.lifecycle)).length;
  const returnTodayCount = rows.filter((row) => row.returnsToday).length;
  const overdueCount = rows.filter((row) => row.urgency === 'overdue').length;
  const handoverCount = rows.filter((row) => row.lifecycle === 'CONFIRMED').length;
  const isArchive = filters.archive === '1';
  const activeTab = isArchive ? 'archive' : filters.status === 'CONFIRMED' ? 'handover' : 'current';
  const vehicleOptions = Array.from(
    new Map(rows.map((row) => [row.vehicleId, row.vehicleName])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1], 'ru'));

  return (
    <main
      className="min-w-0 bg-[var(--color-page)] px-3 py-5 sm:px-6 lg:py-0 lg:pr-[52px] lg:pl-0"
      data-testid="rental-list-page"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 lg:pl-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Аренда</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/rentals?status=CONFIRMED&booking=new"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <FiCalendar aria-hidden /> Новое бронирование
          </Link>
          <Link
            href="/rentals/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <FiPlusCircle aria-hidden /> Новый договор
          </Link>
        </div>
      </header>

      <section className="mt-5 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <nav
          aria-label="Статус договоров"
          className="flex min-w-0 [scrollbar-width:none] gap-8 overflow-x-auto border-b border-[var(--color-border)] px-5 [&::-webkit-scrollbar]:hidden"
        >
          {[
            ['current', 'Текущие', queryString(filters, { archive: undefined, status: undefined })],
            [
              'handover',
              'Бронирования',
              queryString(filters, { archive: undefined, status: 'CONFIRMED' }),
            ],
            ['archive', 'Архив', queryString(filters, { archive: '1', status: undefined })],
          ].map(([key, label, href]) => (
            <Link
              key={key}
              href={href}
              aria-current={activeTab === key ? 'page' : undefined}
              className={`relative inline-flex min-h-[54px] shrink-0 items-center text-sm font-semibold ${activeTab === key ? 'text-[var(--color-primary)] after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <form className="grid gap-3 border-b border-[var(--color-border)] p-4 lg:grid-cols-[minmax(260px,1.5fr)_160px_220px_240px_auto]">
          {isArchive ? <input type="hidden" name="archive" value="1" /> : null}
          <label className="relative min-w-0">
            <FiSearch
              aria-hidden
              className="pointer-events-none absolute top-3.5 left-3 text-[var(--color-text-tertiary)]"
            />
            <input
              name="query"
              aria-label="Поиск по договору или клиенту"
              placeholder="Поиск по договору или клиенту"
              defaultValue={filters.query ?? ''}
              className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-transparent pr-3 pl-10 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <select
            name="status"
            aria-label="Статус"
            defaultValue={filters.status ?? ''}
            className="min-h-11 min-w-0 rounded-lg border border-[var(--color-border)] bg-transparent px-3 text-sm"
          >
            <option value="">Статус: Все</option>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="vehicleId"
            aria-label="Автомобиль"
            defaultValue={filters.vehicleId ?? ''}
            className="min-h-11 min-w-0 rounded-lg border border-[var(--color-border)] bg-transparent px-3 text-sm"
          >
            <option value="">Автомобиль: Все</option>
            {vehicleOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex min-h-11 min-w-0 items-center rounded-lg border border-[var(--color-border)] px-2">
            <input
              name="from"
              aria-label="Дата с"
              type="date"
              defaultValue={filters.from ?? ''}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
            <span className="px-1 text-[var(--color-text-tertiary)]">—</span>
            <input
              name="to"
              aria-label="Дата по"
              type="date"
              defaultValue={filters.to ?? ''}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
            <FiCalendar aria-hidden className="ml-1 shrink-0 text-[var(--color-text-tertiary)]" />
          </div>
          <details className="relative">
            <summary
              role="button"
              aria-label="Фильтры"
              className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 text-sm font-medium"
            >
              <FiFilter aria-hidden /> Фильтры
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid min-w-52 gap-2 rounded-xl border bg-[var(--color-surface)] p-3 shadow-xl">
              <button className="min-h-10 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white">
                Применить
              </button>
              <Link
                href={isArchive ? '/rentals?archive=1' : '/rentals'}
                className="min-h-9 content-center text-center text-sm font-semibold text-[var(--color-primary)]"
              >
                Сбросить фильтры
              </Link>
            </div>
          </details>
        </form>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-secondary)]">
          <span aria-label={`Действуют ${activeCount}`}>
            Действуют <b className="ml-1 text-[var(--color-text)]">{activeCount}</b>
          </span>
          <span aria-hidden className="h-5 w-px bg-[var(--color-border)]" />
          <span aria-label={`Возврат сегодня ${returnTodayCount}`}>
            Возврат сегодня <b className="ml-1 text-[var(--color-text)]">{returnTodayCount}</b>
          </span>
          <span aria-hidden className="h-5 w-px bg-[var(--color-border)]" />
          <span>
            Просрочено <b className="ml-1 text-[var(--color-text)]">{overdueCount}</b>
          </span>
          <span aria-hidden className="h-5 w-px bg-[var(--color-border)]" />
          <span aria-label={`Бронирования ${handoverCount}`}>
            Бронирования <b className="ml-1 text-[var(--color-text)]">{handoverCount}</b>
          </span>
        </div>

        {rows.length ? (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1168px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-2" />
                  <col className="w-[190px]" />
                  <col className="w-[145px]" />
                  <col className="w-[95px]" />
                  <col className="w-[105px]" />
                  <col className="w-[80px]" />
                  <col data-testid="rental-payment-column" className="w-[160px]" />
                  <col data-testid="rental-deposit-column" className="w-[130px]" />
                  <col className="w-[130px]" />
                  <col className="w-[125px]" />
                </colgroup>
                <thead className="bg-[var(--color-elevated)]/45 text-xs font-semibold text-[var(--color-text)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th rowSpan={2} className="p-0">
                      <span className="sr-only">Срочность</span>
                    </th>
                    <th aria-label="Договор / Клиент" rowSpan={2} className="px-4 py-4">
                      Договор /<br />
                      Клиент
                    </th>
                    <th aria-label="Автомобиль / Гос. номер" rowSpan={2} className="px-4 py-4">
                      Автомобиль /<br />
                      Гос. номер
                    </th>
                    <th
                      colSpan={3}
                      className="border-x border-[var(--color-border)] px-3 py-2 text-center"
                    >
                      Период аренды
                    </th>
                    <th className="border-r border-[var(--color-border)] px-3 py-2 text-center">
                      Аренда
                    </th>
                    <th className="border-r border-[var(--color-border)] px-3 py-2 text-center">
                      Залог
                    </th>
                    <th aria-label="Статус" rowSpan={2} className="px-3 py-4 text-center">
                      Статус
                    </th>
                    <th rowSpan={2} className="px-3 py-4 text-center">
                      Действия
                    </th>
                  </tr>
                  <tr className="border-b border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
                    <th className="border-l border-[var(--color-border)] px-3 py-2 text-center">
                      Выдача
                    </th>
                    <th className="px-3 py-2 text-center">Возврат</th>
                    <th className="border-r border-[var(--color-border)] px-3 py-2 text-center">
                      Осталось
                    </th>
                    <th className="border-r border-[var(--color-border)] px-3 py-2 text-center">
                      Сумма и статус
                    </th>
                    <th className="border-r border-[var(--color-border)] px-3 py-2 text-center">
                      Срок возврата
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      data-testid={`rental-row-${row.id}`}
                      data-lifecycle={row.lifecycle}
                      className="h-[94px] align-middle transition-colors duration-150 hover:bg-[var(--color-elevated)]/55"
                    >
                      <td className="relative p-0">
                        {row.isLeaseToOwn ? (
                          <span
                            data-testid={`rental-agreement-strip-${row.id}`}
                            aria-hidden
                            className="absolute inset-y-0 right-0 z-10 block w-2 bg-[#673AB7]"
                          />
                        ) : null}
                        {!row.isLeaseToOwn ? (
                          <span
                            data-testid={`rental-status-strip-${row.id}`}
                            aria-hidden
                            className={`absolute inset-y-0 right-0 block w-2 ${rowAccent[row.urgency]}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/rentals/${row.id}`}
                          className="block truncate font-bold text-[var(--color-primary)] hover:underline"
                        >
                          {row.contractNumber ?? 'Черновик'}
                        </Link>
                        <Link
                          href={`/clients/${row.clientId}`}
                          className="mt-1 block truncate text-[13px] font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]"
                        >
                          {row.clientLabel}
                        </Link>
                        {row.clientPhone ? (
                          <a
                            href={`tel:${row.clientPhone.replace(/[^+\d]/gu, '')}`}
                            className="mt-1 block truncate text-xs text-[var(--color-text-secondary)]"
                          >
                            {row.clientPhone}
                          </a>
                        ) : (
                          <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                            Нет телефона
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/vehicles/${row.vehicleId}`}
                          className="block leading-5 font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]"
                        >
                          {row.vehicleName}
                        </Link>
                        <Link
                          href={`/vehicles/${row.vehicleId}`}
                          className="mt-1 block truncate text-xs font-medium text-[var(--color-text-secondary)]"
                        >
                          {row.registrationNumber}
                        </Link>
                      </td>
                      <td className="border-l border-[var(--color-border)] px-2 py-3 text-center text-xs tabular-nums">
                        {dateTime(row.startsAt)}
                      </td>
                      <td className="px-2 py-3 text-center text-xs font-medium tabular-nums">
                        {dateTime(row.endsAt)}
                      </td>
                      <td
                        className={`border-r border-[var(--color-border)] px-2 py-3 text-center text-xs font-semibold tabular-nums ${row.urgency === 'overdue' ? 'text-rose-600' : row.urgency === 'today' || row.urgency === 'soon' ? 'text-amber-700' : 'text-[var(--color-text)]'}`}
                      >
                        {row.remainingLabel
                          .replace(/^Осталось\s/u, '')
                          .replace(/^Просрочено на\s/u, '−')}
                      </td>
                      <td className="border-r border-[var(--color-border)] px-3 py-2 text-center">
                        <PaymentCell row={row} />
                      </td>
                      <td className="border-r border-[var(--color-border)] px-3 py-2 text-center">
                        <p className="text-sm font-semibold whitespace-nowrap tabular-nums">
                          {row.deposit}
                        </p>
                        <p
                          className={`mt-1 text-xs ${row.depositLabel.startsWith('Вернуть до') ? 'text-[var(--color-text)]' : row.depositTone === 'success' ? 'text-emerald-700' : row.depositTone === 'danger' ? 'text-rose-700' : 'text-[var(--color-text-secondary)]'}`}
                        >
                          {row.depositLabel}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1.5 text-xs font-semibold ${statusTone[row.tone]}`}
                          >
                            {row.label}
                          </span>
                          {row.isLeaseToOwn ? (
                            <span className="inline-flex rounded-full bg-[#673AB7]/10 px-2 py-0.5 text-[10px] font-bold text-[#673AB7]">
                              {row.agreementTypeLabel}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {row.primaryAction === 'EXTEND' ? (
                            <CompactActiveActions row={row} />
                          ) : (
                            <Link
                              href={actionHref(row)}
                              className="font-semibold text-[var(--color-primary)] hover:underline"
                            >
                              {actionLabels[row.primaryAction]}
                            </Link>
                          )}
                          <RentalRowActionsMenu
                            rentalId={row.id}
                            clientId={row.clientId}
                            vehicleId={row.vehicleId}
                            contractNumber={row.contractNumber}
                            documents={row.documents.filter(
                              (document): document is { format: 'PDF' | 'DOCX'; version: number } =>
                                document.format === 'PDF' || document.format === 'DOCX',
                            )}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 xl:hidden">
              {rows.map((row) => (
                <article
                  key={row.id}
                  data-lifecycle={row.lifecycle}
                  className="relative min-w-0 overflow-hidden rounded-xl border bg-[var(--color-surface)] p-4 pl-7"
                >
                  {row.isLeaseToOwn ? (
                    <span
                      data-testid={`rental-agreement-strip-${row.id}`}
                      aria-hidden
                      className="absolute inset-y-0 left-0 z-10 w-2 bg-[#673AB7]"
                    />
                  ) : null}
                  {!row.isLeaseToOwn ? (
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-2 ${rowAccent[row.urgency]}`}
                    />
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/rentals/${row.id}`}
                        className="font-bold text-[var(--color-primary)]"
                      >
                        {row.contractNumber ?? 'Черновик'}
                      </Link>
                      {row.isLeaseToOwn ? (
                        <span className="mt-1 inline-flex rounded-full bg-[#673AB7]/10 px-2 py-0.5 text-[10px] font-bold text-[#673AB7]">
                          {row.agreementTypeLabel}
                        </span>
                      ) : null}
                      <Link
                        href={`/clients/${row.clientId}`}
                        className="mt-1 block truncate font-semibold"
                      >
                        {row.clientLabel}
                      </Link>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-1 text-[11px] font-semibold ${statusTone[row.tone]}`}
                    >
                      {row.label}
                    </span>
                  </div>
                  <Link
                    href={`/vehicles/${row.vehicleId}`}
                    className="mt-3 block truncate text-sm font-medium"
                  >
                    {row.vehicleName} · {row.registrationNumber}
                  </Link>
                  <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 border-y border-[var(--color-border)] py-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-[var(--color-text-secondary)]">Возврат</p>
                      <p className="mt-1 font-semibold break-words">{dateTime(row.endsAt)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[var(--color-text-secondary)]">Осталось</p>
                      <p className="mt-1 font-semibold break-words">{row.remainingLabel}</p>
                    </div>
                    <PaymentCell row={row} />
                    <div className="min-w-0">
                      <p className="text-[var(--color-text-secondary)]">Залог</p>
                      <p className="mt-1 font-semibold break-words">
                        {row.deposit} · {row.depositLabel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    {row.primaryAction === 'EXTEND' ? (
                      <CompactActiveActions row={row} mobile />
                    ) : (
                      <Link
                        href={actionHref(row)}
                        className="min-h-11 content-center rounded-lg border border-[var(--color-primary)] px-4 font-semibold text-[var(--color-primary)]"
                      >
                        {actionLabels[row.primaryAction]}
                      </Link>
                    )}
                    <RentalRowActionsMenu
                      rentalId={row.id}
                      clientId={row.clientId}
                      vehicleId={row.vehicleId}
                      contractNumber={row.contractNumber}
                      documents={row.documents.filter(
                        (document): document is { format: 'PDF' | 'DOCX'; version: number } =>
                          document.format === 'PDF' || document.format === 'DOCX',
                      )}
                    />
                  </div>
                </article>
              ))}
            </div>

            <footer className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-secondary)]">
              <span>
                Показано {rows.length ? '1' : '0'}–{rows.length} из {rows.length}
              </span>
              <div className="flex items-center gap-3">
                <nav aria-label="Страницы договоров" className="flex items-center gap-1">
                  <button
                    aria-label="Предыдущая страница"
                    disabled
                    className="grid size-9 place-items-center rounded-lg border disabled:opacity-40"
                  >
                    <FiChevronLeft aria-hidden />
                  </button>
                  <span className="grid size-9 place-items-center rounded-lg border border-[var(--color-primary)] font-semibold text-[var(--color-primary)]">
                    1
                  </span>
                  <button
                    aria-label="Следующая страница"
                    disabled
                    className="grid size-9 place-items-center rounded-lg border disabled:opacity-40"
                  >
                    <FiChevronRight aria-hidden />
                  </button>
                </nav>
                <select
                  aria-label="Договоров на странице"
                  className="min-h-9 rounded-lg border bg-transparent px-2"
                >
                  <option>20 / стр.</option>
                  <option>50 / стр.</option>
                </select>
              </div>
            </footer>
          </>
        ) : (
          <div className="grid min-h-48 place-items-center p-6 text-center text-[var(--color-text-secondary)]">
            <div>
              <p>
                {Object.values(filters).some(Boolean)
                  ? 'По заданным условиям договоры не найдены.'
                  : 'Договоров аренды пока нет.'}
              </p>
              <Link
                href={isArchive ? '/rentals?archive=1' : '/rentals'}
                className="mt-3 inline-flex min-h-10 items-center font-semibold text-[var(--color-primary)]"
              >
                Очистить условия
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
