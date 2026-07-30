import type { VehicleTrackPeriodViewModel, VehicleTrackSegment } from '../track-types';

function formatDate(date: string): string {
  return date.split('-').reverse().join('.');
}

export function TrackSegmentList({
  model,
  previewedSegmentId,
  onPreview,
}: {
  model: VehicleTrackPeriodViewModel;
  previewedSegmentId: string | null;
  onPreview: (segment: VehicleTrackSegment | null) => void;
}) {
  return (
    <section aria-label="Участки маршрута" className="grid gap-2">
      <details
        open
        className="group rounded-[var(--radius-md)] border border-[var(--color-border)]"
      >
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
          Участки маршрута
        </summary>
        <div className="grid gap-4 border-t border-[var(--color-border)] p-3">
          {model.trips.map((trip) => {
            const date = formatDate(trip.date);

            return (
              <div key={trip.tripId} className="grid gap-2">
                <h4 className="text-sm font-semibold">Поездка {date}</h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Старт поездки {date} · {trip.start.timestamp} · {trip.start.address}
                </p>
                <div className="grid gap-2">
                  {trip.segments.map((segment) => {
                    const preview = () => onPreview(segment);

                    return (
                      <button
                        key={segment.id}
                        type="button"
                        aria-label={`Участок ${date}, ${segment.from.timestamp}–${segment.to.timestamp}, ${segment.speedKph} км/ч, ${segment.to.address}`}
                        data-previewed={previewedSegmentId === segment.id}
                        onMouseEnter={preview}
                        onMouseLeave={() => onPreview(null)}
                        onFocus={preview}
                        onBlur={() => onPreview(null)}
                        onClick={preview}
                        className="grid min-h-11 gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-left text-xs transition-colors hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] data-[previewed=true]:border-[var(--color-primary)] data-[previewed=true]:bg-[var(--color-primary-soft)]"
                      >
                        <span className="font-semibold">
                          {segment.from.timestamp}–{segment.to.timestamp} · {segment.speedKph} км/ч
                        </span>
                        <span className="text-[var(--color-text-secondary)]">
                          {segment.to.address}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Финиш поездки {date} · {trip.finish.timestamp} · {trip.finish.address}
                </p>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
