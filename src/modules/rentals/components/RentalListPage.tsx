import Link from 'next/link';
import { FaFilePdf, FaFileWord } from 'react-icons/fa6';

import { presentRentalListRow, type RentalListSource } from './rental-list-presentation';

type Filters = { query?: string; status?: string; from?: string; to?: string };
const statusOptions = [
  ['ACTIVE', 'Действуют'],
  ['CONFIRMED', 'Ожидают выдачи'],
  ['COMPLETED', 'Закрыты'],
  ['DRAFT', 'Черновики'],
] as const;
const toneClasses = {
  success: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-400 bg-amber-50 text-amber-900',
  danger: 'border-rose-400 bg-rose-50 text-rose-800',
  info: 'border-blue-400 bg-blue-50 text-blue-800',
  neutral: 'border-slate-300 bg-slate-50 text-slate-700',
} as const;

function dateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
function queryString(filters: Filters, extra: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra }))
    if (value) params.set(key, value);
  return `/rentals?${params.toString()}`;
}

function RentalFiles({ row }: { row: ReturnType<typeof presentRentalListRow> }) {
  if (!row.documents.length)
    return <span className="text-xs text-[var(--color-text-secondary)]">Нет файлов</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {row.documents.map((document) => {
        const isWord = document.format === 'DOCX';
        const label = isWord ? 'Word' : 'PDF';
        const Icon = isWord ? FaFileWord : FaFilePdf;
        return (
          <a
            key={`${document.version}-${document.format}`}
            href={`/rentals/${row.id}/documents/${document.version}/${document.format}`}
            download
            aria-label={`Скачать ${label} ${row.contractNumber ?? 'договора'}`}
            title={`Скачать ${label}`}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
              isWord ? 'text-blue-700' : 'text-rose-700'
            }`}
          >
            <Icon aria-hidden className="text-lg" />
            {label}
          </a>
        );
      })}
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
  const count = (values: string[]) => rows.filter((row) => values.includes(row.lifecycle)).length;
  const summary = [
    ['Действуют', count(['ACTIVE']), 'text-emerald-700'],
    ['Продлены', count(['EXTENDED']), 'text-amber-700'],
    ['Ожидают выдачи', count(['CONFIRMED']), 'text-blue-700'],
    ['Закрыты', count(['COMPLETED', 'CANCELLED']), 'text-rose-700'],
  ] as const;
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="rental-list-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-primary)]">Аренда СУПА ПРО</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Договоры аренды</h1>
        </div>
        <div className="flex min-h-11 items-center gap-2">
          <Link className="rounded-xl border px-4 py-2.5 font-semibold" href="/rentals">
            Список
          </Link>
          <Link
            className="rounded-xl border px-4 py-2.5 font-semibold"
            href={queryString(filters, { view: 'calendar' })}
          >
            Календарь
          </Link>
          <Link
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-semibold text-white"
            href="/clients"
          >
            Новый договор
          </Link>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Сводка договоров">
        {summary.map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border bg-[var(--color-surface)] p-4 shadow-sm">
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{label}</div>
          </div>
        ))}
      </section>
      <form className="grid gap-3 rounded-2xl border bg-[var(--color-surface)] p-3 lg:grid-cols-[minmax(240px,1fr)_180px_150px_150px_auto]">
        <input name="view" type="hidden" value="list" />
        <input
          name="query"
          aria-label="Поиск клиента или автомобиля"
          className="min-h-11 rounded-xl border bg-transparent px-3"
          placeholder="Фамилия, договор, машина или госномер"
          defaultValue={filters.query ?? ''}
        />
        <select
          name="status"
          aria-label="Статус"
          className="min-h-11 rounded-xl border bg-transparent px-3"
          defaultValue={filters.status ?? ''}
        >
          <option value="">Все статусы</option>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="CANCELLED">Отменены</option>
        </select>
        <input
          name="from"
          aria-label="Дата с"
          type="date"
          className="min-h-11 rounded-xl border bg-transparent px-3"
          defaultValue={filters.from ?? ''}
        />
        <input
          name="to"
          aria-label="Дата по"
          type="date"
          className="min-h-11 rounded-xl border bg-transparent px-3"
          defaultValue={filters.to ?? ''}
        />
        <button className="min-h-11 rounded-xl bg-[var(--color-primary)] px-5 font-semibold text-white">
          Найти
        </button>
      </form>
      <nav className="flex flex-wrap gap-2" aria-label="Быстрые фильтры">
        <Link href="/rentals" className="rounded-full border px-3 py-2 text-sm font-semibold">
          Все
        </Link>
        {statusOptions.map(([value, label]) => (
          <Link
            key={value}
            href={queryString(filters, { status: value })}
            className="rounded-full border px-3 py-2 text-sm font-semibold"
          >
            {label}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-[var(--color-surface)] shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-elevated)] text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
                <tr>
                  {[
                    'Договор',
                    'Клиент',
                    'Автомобиль',
                    'Срок',
                    'Сумма / залог',
                    'Статус',
                    'Файлы',
                    'Действия',
                  ].map((label) => (
                    <th key={label} className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-l-4 transition hover:bg-[var(--color-elevated)] ${toneClasses[row.tone]}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        className="font-bold text-[var(--color-primary)]"
                        href={`/rentals/${row.id}`}
                      >
                        {row.contractNumber ?? 'Черновик'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">
                      {row.clientLabel}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      {row.vehicleLabel}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-primary)]">
                      <div>{dateTime(row.startsAt)}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Окончание: {dateTime(row.endsAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-primary)]">
                      <div className="font-bold">{row.total}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Залог {row.deposit}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${toneClasses[row.tone]}`}
                      >
                        {row.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RentalFiles row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/rentals/${row.id}`}
                          className="min-h-11 content-center rounded-xl border bg-white px-3 font-semibold text-slate-900"
                        >
                          Открыть
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.id}
                className={`rounded-2xl border-l-4 p-4 shadow-sm ${toneClasses[row.tone]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/rentals/${row.id}`}
                      className="font-bold text-[var(--color-primary)]"
                    >
                      {row.contractNumber ?? 'Черновик'}
                    </Link>
                    <h2 className="mt-2 font-bold text-[var(--color-text-primary)]">
                      {row.clientLabel}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${toneClasses[row.tone]}`}
                  >
                    {row.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-primary)]">{row.vehicleLabel}</p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Начало: {dateTime(row.startsAt)}
                  <br />
                  <b>Окончание: {dateTime(row.endsAt)}</b>
                </p>
                <div className="mt-3">
                  <RentalFiles row={row} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--color-text-primary)]">{row.total}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      Залог {row.deposit}
                    </div>
                  </div>
                  <Link
                    href={`/rentals/${row.id}`}
                    className="min-h-11 content-center rounded-xl bg-white px-4 font-semibold text-slate-900"
                  >
                    Открыть
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="grid justify-items-start gap-3 rounded-2xl border p-6 text-[var(--color-text-secondary)]">
          <p>
            {Object.values(filters).some(Boolean)
              ? 'По заданным условиям договоры не найдены.'
              : 'Договоров аренды пока нет.'}
          </p>
          {Object.values(filters).some(Boolean) ? (
            <Link
              href="/rentals"
              className="min-h-11 content-center font-semibold text-[var(--color-primary)]"
            >
              Сбросить фильтры
            </Link>
          ) : (
            <Link
              href="/clients"
              className="min-h-11 content-center font-semibold text-[var(--color-primary)]"
            >
              Создать первый договор
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
