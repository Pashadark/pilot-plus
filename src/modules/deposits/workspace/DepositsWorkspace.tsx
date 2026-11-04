import Link from 'next/link';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiSearch,
  FiShield,
  FiUser,
} from 'react-icons/fi';

import type {
  DepositWorkspaceFilter,
  DepositWorkspaceRow,
  DepositWorkspaceSummary,
  DepositWorkspaceStatus,
} from './model';

const statusPresentation: Record<DepositWorkspaceStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'В аренде', className: 'bg-[#0067ff]/12 text-[#4d9dff]' },
  PENDING: {
    label: 'Ожидает срока',
    className: 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
  },
  SOON: {
    label: 'Скоро вернуть',
    className: 'bg-[var(--color-warning)]/14 text-[var(--color-warning)]',
  },
  TODAY: { label: 'Сегодня', className: 'bg-[var(--color-danger)]/14 text-[var(--color-danger)]' },
  OVERDUE: {
    label: 'Просрочено',
    className: 'bg-[var(--color-danger)]/14 text-[var(--color-danger)]',
  },
  DEBT: {
    label: 'Есть задолженность',
    className: 'bg-[var(--color-danger)]/14 text-[var(--color-danger)]',
  },
  RETURNED: {
    label: 'Возвращён',
    className: 'bg-[var(--color-success)]/14 text-[var(--color-success)]',
  },
  RETURNED_WITH_WITHHOLDING: {
    label: 'Возвращён с удержанием',
    className: 'bg-[var(--color-success)]/14 text-[var(--color-success)]',
  },
  WITHHELD: {
    label: 'Удержан полностью',
    className: 'bg-[var(--color-warning)]/14 text-[var(--color-warning)]',
  },
};

const entryLabels: Record<string, string> = {
  DEPOSIT_PAYMENT: 'Залог внесён',
  MANUAL_CREDIT: 'Дополнительное внесение',
  FINE_RESERVATION: 'Резерв под штраф',
  FINE_RESERVATION_ADJUSTMENT: 'Корректировка резерва',
  FINE_RESERVATION_RELEASE: 'Резерв освобождён',
  FINE_WITHHOLDING: 'Окончательное удержание',
  DEPOSIT_RETURN: 'Возврат залога',
  DEBT_PAYMENT: 'Погашение задолженности',
  MANUAL_CORRECTION: 'Ручная корректировка',
};

const filters: Array<{ value: DepositWorkspaceFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'urgent', label: 'Срочно' },
  { value: 'soon', label: 'Скоро' },
  { value: 'active', label: 'В аренде' },
  { value: 'returned', label: 'Возвращены' },
  { value: 'debt', label: 'Задолженность' },
];

function money(value: bigint, currency = 'RUB') {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

function date(value: string | Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(typeof value === 'string' ? new Date(`${value}T12:00:00.000Z`) : value);
}

function filterHref(value: DepositWorkspaceFilter, query: string) {
  const params = new URLSearchParams();
  if (value !== 'all') params.set('filter', value);
  if (query) params.set('q', query);
  const suffix = params.toString();
  return suffix ? `/deposits?${suffix}` : '/deposits';
}

function Delta({ label, value, currency }: { label: string; value: bigint; currency: string }) {
  if (value === 0n) return null;
  return (
    <span className={value > 0n ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>
      {label} {value > 0n ? '+' : ''}
      {money(value, currency)}
    </span>
  );
}

export function DepositsWorkspace({
  rows,
  summary,
  query,
  filter,
}: {
  rows: readonly DepositWorkspaceRow[];
  summary: DepositWorkspaceSummary;
  query: string;
  filter: DepositWorkspaceFilter;
}) {
  const cards = [
    { label: 'Доступно к возврату', value: money(summary.availableMinor), icon: FiDollarSign },
    { label: 'Срочно и скоро', value: String(summary.urgentCount), icon: FiClock },
    { label: 'Зарезервировано', value: money(summary.reservedMinor), icon: FiShield },
    { label: 'Задолженность', value: money(summary.debtMinor), icon: FiAlertCircle },
  ];
  return (
    <div className="space-y-5" data-testid="deposits-workspace">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#4d9dff] uppercase">
            Финансы договоров
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Залоги</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Возвраты, резервы под штрафы и полная история по каждому договору.
          </p>
        </div>
        <form className="relative w-full xl:max-w-xl" action="/deposits">
          {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
          <FiSearch
            aria-hidden="true"
            className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Клиент, машина, госномер или договор"
            className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] pr-24 pl-11 text-sm outline-none focus:border-[#0067ff]"
          />
          <button
            className="absolute top-1.5 right-1.5 min-h-9 rounded-[var(--radius-sm)] bg-[#0067ff] px-4 text-sm font-bold text-white"
            type="submit"
          >
            Найти
          </button>
        </form>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Сводка по залогам">
        {cards.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="flex min-h-28 items-center gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#0067ff]/12 text-[#4d9dff]">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
              <strong className="mt-1 block text-2xl font-black tabular-nums">{value}</strong>
            </div>
          </article>
        ))}
      </section>

      <nav aria-label="Фильтры залогов" className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <Link
            key={item.value}
            href={filterHref(item.value, query)}
            aria-current={filter === item.value ? 'page' : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${filter === item.value ? 'border-[#0067ff] bg-[#0067ff] text-white' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section
        className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]"
        aria-label="Реестр залогов"
      >
        <div className="hidden grid-cols-[minmax(210px,1.4fr)_minmax(180px,1fr)_repeat(3,minmax(120px,.7fr))_minmax(145px,.8fr)_52px] gap-3 border-b border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] xl:grid">
          <span>Клиент и договор</span>
          <span>Автомобиль</span>
          <span>Залог</span>
          <span>Доступно</span>
          <span>Резерв / долг</span>
          <span>Срок и статус</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="grid min-h-52 place-items-center px-6 text-center">
            <div>
              <FiCheckCircle className="mx-auto size-8 text-[var(--color-text-muted)]" />
              <p className="mt-3 font-bold">Залоги не найдены</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Измените поиск или быстрый фильтр.
              </p>
            </div>
          </div>
        ) : (
          rows.map((row) => {
            const status = statusPresentation[row.status];
            return (
              <details
                key={row.id}
                className="group border-b border-[var(--color-border)] last:border-b-0"
              >
                <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 hover:bg-[var(--color-elevated)] xl:grid-cols-[minmax(210px,1.4fr)_minmax(180px,1fr)_repeat(3,minmax(120px,.7fr))_minmax(145px,.8fr)_52px] xl:items-center">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-bold">
                      <FiUser aria-hidden="true" className="size-4 shrink-0 text-[#4d9dff]" />
                      {row.clientName}
                    </span>
                    <small className="mt-1 block text-[var(--color-text-secondary)]">
                      {row.contractNumber}
                    </small>
                  </span>
                  <span className="min-w-0 font-semibold">
                    {row.vehicleName}
                    <small className="mt-1 block text-[var(--color-text-secondary)]">
                      {row.registrationNumber || 'Без госномера'}
                    </small>
                  </span>
                  <span>
                    <small className="xl:hidden">Залог</small>
                    <strong className="block tabular-nums">
                      {money(row.initialMinor, row.currency)}
                    </strong>
                  </span>
                  <span>
                    <small className="xl:hidden">Доступно</small>
                    <strong className="block tabular-nums">
                      {money(row.availableMinor, row.currency)}
                    </strong>
                  </span>
                  <span className="text-sm">
                    <span className="block text-[var(--color-warning)] tabular-nums">
                      Резерв {money(row.reservedMinor, row.currency)}
                    </span>
                    {row.debtMinor > 0n ? (
                      <span className="mt-1 block text-[var(--color-danger)] tabular-nums">
                        Долг {money(row.debtMinor, row.currency)}
                      </span>
                    ) : null}
                  </span>
                  <span>
                    <strong className="block text-sm tabular-nums">{date(row.returnDueOn)}</strong>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </span>
                  <FiChevronRight
                    aria-hidden="true"
                    className="size-5 text-[var(--color-text-muted)] transition-transform group-open:rotate-90"
                  />
                </summary>
                <div className="border-t border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-bold">История залога</h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Удержано всего: {money(row.withheldMinor, row.currency)}
                      </p>
                    </div>
                    <Link
                      href={`/rentals/${row.id}`}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[#0067ff] px-4 text-sm font-bold text-white"
                    >
                      <FiFileText aria-hidden="true" />
                      Открыть договор
                    </Link>
                  </div>
                  <ol className="mt-4 space-y-2">
                    {row.history.length === 0 ? (
                      <li className="text-sm text-[var(--color-text-secondary)]">
                        Операций пока нет.
                      </li>
                    ) : (
                      row.history.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            <strong>{entryLabels[entry.kind] ?? entry.kind}</strong>
                            <small className="mt-1 block text-[var(--color-text-secondary)]">
                              {entry.reason || 'Без комментария'} · {date(entry.occurredAt)}
                            </small>
                          </span>
                          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
                            <Delta
                              label="Баланс"
                              value={entry.cashDeltaMinor}
                              currency={row.currency}
                            />
                            <Delta
                              label="Резерв"
                              value={entry.reservedDeltaMinor}
                              currency={row.currency}
                            />
                            <Delta
                              label="Удержано"
                              value={entry.withheldDeltaMinor}
                              currency={row.currency}
                            />
                            <Delta
                              label="Долг"
                              value={entry.debtDeltaMinor}
                              currency={row.currency}
                            />
                          </span>
                        </li>
                      ))
                    )}
                  </ol>
                </div>
              </details>
            );
          })
        )}
      </section>
    </div>
  );
}
