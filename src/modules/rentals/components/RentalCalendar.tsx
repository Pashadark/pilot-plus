import Link from 'next/link';

export type RentalCalendarEntry = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  vehicleLabel: string;
  clientLabel: string;
};

const moscow = 'Europe/Moscow';
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/u;

function dayStart(date: string) {
  return new Date(`${date}T00:00:00+03:00`);
}

function moscowDay(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: moscow,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

function russianDate(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: moscow,
    day: 'numeric',
    month: 'long',
  }).format(value);
}

function validRental(rental: RentalCalendarEntry) {
  const startsAt = new Date(rental.startsAt);
  const endsAt = new Date(rental.endsAt);
  return (
    Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime()) && startsAt < endsAt
  );
}

export function RentalCalendar({
  month,
  rentals,
}: {
  month: string;
  rentals: readonly RentalCalendarEntry[];
}) {
  const safeMonth = monthPattern.test(month) ? month : moscowDay(new Date()).slice(0, 7);
  const monthStart = dayStart(`${safeMonth}-01`);
  const [year, monthNumber] = safeMonth.split('-').map(Number) as [number, number];
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
  const monthEnd = dayStart(`${nextYear}-${String(nextMonthNumber).padStart(2, '0')}-01`);
  const monthWeekday = new Date(`${safeMonth}-01T12:00:00.000+03:00`);
  const nextMonthWeekday = new Date(
    `${nextYear}-${String(nextMonthNumber).padStart(2, '0')}-01T12:00:00.000+03:00`,
  );
  const mondayOffset = (monthWeekday.getUTCDay() + 6) % 7;
  const calendarStart = addDays(monthStart, -mondayOffset);
  const calendarEnd = addDays(monthEnd, (7 - ((nextMonthWeekday.getUTCDay() + 6) % 7)) % 7);
  const days = Array.from(
    { length: Math.round((calendarEnd.getTime() - calendarStart.getTime()) / 86_400_000) },
    (_, index) => addDays(calendarStart, index),
  );
  const monthRentals = rentals.filter(
    (rental) =>
      validRental(rental) &&
      new Date(rental.startsAt) < monthEnd &&
      new Date(rental.endsAt) > monthStart,
  );
  const agenda = [...monthRentals].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const label = new Intl.DateTimeFormat('ru-RU', {
    timeZone: moscow,
    month: 'long',
    year: 'numeric',
  }).format(monthStart);

  return (
    <section className="grid min-w-0 gap-4" aria-label={`Календарь аренд: ${label}`}>
      <h2 className="text-lg font-bold capitalize">{label}</h2>
      <div
        className="hidden grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-border)] sm:grid"
        role="grid"
        data-testid="rental-calendar-grid"
      >
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
          <div
            key={label}
            role="columnheader"
            className="bg-[var(--color-elevated)] p-2 text-center text-xs font-semibold"
          >
            {label}
          </div>
        ))}
        {days.map((day) => {
          const nextDay = addDays(day, 1);
          const inMonth = moscowDay(day).slice(0, 7) === safeMonth;
          const entries = inMonth
            ? monthRentals.filter(
                (rental) => new Date(rental.startsAt) < nextDay && new Date(rental.endsAt) > day,
              )
            : [];
          const description = entries
            .map((entry) => `${entry.vehicleLabel}, ${entry.clientLabel}`)
            .join('; ');
          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              aria-label={`${russianDate(day)}${description ? `: ${description}` : ''}`}
              className={`min-h-24 bg-[var(--color-surface)] p-2 text-sm ${inMonth ? '' : 'text-[var(--color-text-secondary)]'}`}
            >
              <span className="block font-semibold">
                {new Intl.DateTimeFormat('ru-RU', { timeZone: moscow, day: 'numeric' }).format(day)}
              </span>
              {entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/rentals/${entry.id}`}
                  className="mt-1 block truncate rounded bg-[var(--color-primary-soft)] px-1 text-xs text-[var(--color-primary)] focus-visible:outline-2"
                >
                  <span className="block truncate">{entry.vehicleLabel}</span>
                  <span className="block truncate">{entry.clientLabel}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      <ul data-testid="rental-calendar-agenda" className="grid gap-2 sm:hidden">
        {agenda.map((rental) => (
          <li key={rental.id}>
            <Link
              href={`/rentals/${rental.id}`}
              className="grid min-h-11 gap-1 rounded-[var(--radius-md)] border p-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              <span className="font-semibold">
                {russianDate(new Date(rental.startsAt))} · {rental.vehicleLabel}
              </span>
              <span className="text-[var(--color-text-secondary)]">{rental.clientLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
