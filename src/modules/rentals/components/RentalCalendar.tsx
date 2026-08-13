import Link from 'next/link';

export type RentalCalendarEntry = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  vehicleLabel: string;
  clientLabel: string;
};

function russianDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
  }).format(new Date(value));
}

export function RentalCalendar({
  month,
  rentals,
}: {
  month: string;
  rentals: readonly RentalCalendarEntry[];
}) {
  const label = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T00:00:00+03:00`));
  return (
    <section className="grid min-w-0 gap-4" aria-label={`Календарь аренд: ${label}`}>
      <h2 className="text-lg font-bold capitalize">{label}</h2>
      <div
        data-testid="rental-calendar-grid"
        role="grid"
        className="hidden grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-border)] sm:grid"
      >
        {rentals.map((rental) => (
          <Link
            key={rental.id}
            href={`/rentals/${rental.id}`}
            role="gridcell"
            className="min-h-24 bg-[var(--color-surface)] p-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            <span className="block font-semibold">{russianDate(rental.startsAt)}</span>
            <span className="block truncate">{rental.vehicleLabel}</span>
            <span className="block truncate text-[var(--color-text-secondary)]">
              {rental.clientLabel}
            </span>
          </Link>
        ))}
      </div>
      <ul data-testid="rental-calendar-agenda" className="grid gap-2 sm:hidden">
        {rentals.map((rental) => (
          <li key={rental.id}>
            <Link
              href={`/rentals/${rental.id}`}
              className="grid min-h-11 gap-1 rounded-[var(--radius-md)] border p-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              <span className="font-semibold">
                {russianDate(rental.startsAt)} · {rental.vehicleLabel}
              </span>
              <span className="text-[var(--color-text-secondary)]">{rental.clientLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
