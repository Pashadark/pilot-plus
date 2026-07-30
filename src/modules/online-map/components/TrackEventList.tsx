import type { VehicleTrackEventView, VehicleTrackPeriodViewModel } from '../track-types';

const eventTypeLabels: Record<VehicleTrackEventView['type'], string> = {
  stop: 'Остановка',
  refuel: 'Заправка',
  speeding: 'Превышение скорости',
  'connection-loss': 'Потеря связи',
  'geofence-enter': 'Въезд в геозону',
  'geofence-exit': 'Выезд из геозоны',
};

function formatDate(date: string): string {
  return date.split('-').reverse().join('.');
}

export function TrackEventList({
  model,
  selectedEventId,
  onActivate,
}: {
  model: VehicleTrackPeriodViewModel;
  selectedEventId: string | null;
  onActivate: (event: VehicleTrackEventView) => void;
}) {
  return (
    <section aria-label="События маршрута" className="grid gap-3">
      <h3 className="font-semibold">События на маршруте</h3>
      {model.trips.map((trip) => (
        <div key={trip.tripId} className="grid gap-2">
          {model.trips.length > 1 ? (
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Поездка {formatDate(trip.date)}
            </p>
          ) : null}
          <div className="grid gap-2">
            {trip.events.map((event) => {
              const activate = () => onActivate(event);
              const countAtPoint = trip.events.filter(
                (candidate) =>
                  candidate.coordinates[0] === event.coordinates[0] &&
                  candidate.coordinates[1] === event.coordinates[1],
              ).length;

              return (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`${eventTypeLabels[event.type]}, ${event.timestamp}`}
                  aria-pressed={selectedEventId === event.id}
                  onMouseEnter={activate}
                  onFocus={activate}
                  onClick={activate}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{event.title}</span>
                    <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                      {event.timestamp} · {event.address}
                    </span>
                  </span>
                  {countAtPoint > 1 ? (
                    <span className="shrink-0 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-semibold text-white">
                      В точке: {countAtPoint}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
