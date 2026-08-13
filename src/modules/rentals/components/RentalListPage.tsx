import Link from 'next/link';
import { RentalCalendar, type RentalCalendarEntry } from './RentalCalendar';

type Row = RentalCalendarEntry & {
  contractNumber: string | null;
  totalPriceMinor: bigint;
  currency: string;
};
const status: Record<string, string> = {
  DRAFT: 'Черновик',
  CONFIRMED: 'Подтверждён',
  ACTIVE: 'Активен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};
export function RentalListPage({ rentals }: { rentals: readonly Row[] }) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="rental-list-page">
      <header>
        <p className="text-sm font-semibold text-[var(--color-primary)]">Аренда Pilot+</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Договоры аренды</h1>
      </header>
      <form className="grid gap-3 sm:grid-cols-5">
        <input
          name="query"
          aria-label="Поиск клиента или автомобиля"
          className="min-h-11 rounded-[var(--radius-md)] border px-3"
          placeholder="Клиент или автомобиль"
        />
        <select
          name="status"
          aria-label="Статус"
          className="min-h-11 rounded-[var(--radius-md)] border px-3"
        >
          <option value="">Все статусы</option>
          {Object.entries(status).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input
          name="from"
          aria-label="Дата с"
          type="date"
          className="min-h-11 rounded-[var(--radius-md)] border px-3"
        />
        <input
          name="to"
          aria-label="Дата по"
          type="date"
          className="min-h-11 rounded-[var(--radius-md)] border px-3"
        />
        <button className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 text-white">
          Применить
        </button>
      </form>
      {rentals.length ? (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Договор</th>
                  <th>Клиент</th>
                  <th>Автомобиль</th>
                  <th>Срок</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/rentals/${r.id}`}>{r.contractNumber ?? 'Черновик'}</Link>
                    </td>
                    <td>{r.clientLabel}</td>
                    <td>{r.vehicleLabel}</td>
                    <td>{new Date(r.startsAt).toLocaleDateString('ru-RU')}</td>
                    <td>{status[r.status] ?? r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RentalCalendar month={new Date().toISOString().slice(0, 7)} rentals={rentals} />
        </>
      ) : (
        <p className="rounded-[var(--radius-md)] border p-6 text-[var(--color-text-secondary)]">
          Договоров аренды пока нет.
        </p>
      )}
    </main>
  );
}
