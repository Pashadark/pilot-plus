import { FiActivity } from 'react-icons/fi';

import type { TimelineFilters } from '../server/queries';
import type { TimelineEventDto } from '../types';

import { EventsWorkspace } from './EventsWorkspace';

export function EventsPage({
  events,
  nextCursor,
  stats,
  vehicles,
  filters,
}: {
  events: readonly TimelineEventDto[];
  nextCursor: { before: string; beforeKey: string } | null;
  stats: { total: number; danger: number; unread: number; vehicles: number };
  vehicles: readonly { id: string; label: string }[];
  filters: TimelineFilters;
}) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="events-page">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
            <FiActivity aria-hidden="true" /> Телематика Pilot+
          </p>
          <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">
            История событий
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Единая хронология автомобиля и автопарка: тревоги, поездки, сервис и ручные записи.
          </p>
        </div>
      </header>
      <EventsWorkspace
        events={events}
        nextCursor={nextCursor}
        stats={stats}
        vehicles={vehicles}
        filters={filters}
      />
    </main>
  );
}
