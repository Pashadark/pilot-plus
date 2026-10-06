import { FiAlertTriangle, FiChevronRight, FiMapPin, FiNavigation } from 'react-icons/fi';

import { buildTrackActivitySections } from '../track-model';
import type {
  VehicleTrackActivitySection,
  VehicleTrackPeriodViewModel,
  VehicleTrackSegment,
} from '../track-types';

function formatDate(date: string): string {
  return date.split('-').reverse().join('.');
}

const activityStyles = {
  moving: {
    label: 'Движение', icon: FiNavigation,
    shell: 'border-[var(--color-success)]/25 bg-[var(--color-success-soft)]',
    badge: 'bg-[var(--color-surface)] text-[var(--color-success)]',
  },
  speeding: {
    label: 'Превышение', icon: FiAlertTriangle,
    shell: 'border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)]',
    badge: 'bg-[var(--color-surface)] text-[var(--color-danger)]',
  },
  stopped: {
    label: 'Стоянка', icon: FiMapPin,
    shell: 'border-[var(--color-border)] bg-[var(--color-elevated)]/45',
    badge: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
  },
} as const;

export function TrackSegmentList({
  model, previewedSegmentId, selectedActivityId, onPreview, onActivate, onEndpointActivate,
}: {
  model: VehicleTrackPeriodViewModel;
  previewedSegmentId: string | null;
  selectedActivityId: string | null;
  onPreview: (segment: VehicleTrackSegment | null) => void;
  onActivate: (activity: VehicleTrackActivitySection | null) => void;
  onEndpointActivate: (tripId: string, endpoint: 'start' | 'finish') => void;
}) {
  return (
    <section aria-label="Участки маршрута" className="grid gap-2">
      <details open className="group rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <summary className="min-h-11 cursor-pointer px-3 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
          Участки маршрута
        </summary>
        <div className="grid gap-4 border-t border-[var(--color-border)] p-3">
          {model.trips.map((trip) => {
            const date = formatDate(trip.date);
            const activities = buildTrackActivitySections(trip.segments);
            return (
              <div key={trip.tripId} className="grid gap-2">
                <h4 className="text-sm font-semibold">Поездка {date}</h4>
                <EndpointButton label="Старт поездки" date={date} time={trip.start.timestamp}
                  address={trip.start.address} onClick={() => onEndpointActivate(trip.tripId, 'start')} />
                <div className="grid gap-2">
                  {activities.map((activity) => {
                    const style = activityStyles[activity.kind];
                    const Icon = style.icon;
                    const representative = getRepresentativeSegment(activity);
                    const isSelected = selectedActivityId === activity.id;
                    const isPreviewed = activity.segmentIds.includes(previewedSegmentId ?? '');
                    const speedLabel = activity.kind === 'stopped'
                      ? formatDuration(activity.durationMinutes)
                      : activity.kind === 'speeding'
                        ? `до ${activity.maxSpeedKph} км/ч`
                        : `${activity.averageSpeedKph} км/ч`;
                    return (
                      <button key={activity.id} type="button"
                        aria-label={`${style.label} ${date}, ${activity.from.timestamp}–${activity.to.timestamp}, ${speedLabel}, ${activity.address}`}
                        aria-pressed={isSelected} data-previewed={isPreviewed}
                        onMouseEnter={() => onPreview(representative)}
                        onMouseLeave={() => { if (!isSelected) onPreview(null); }}
                        onFocus={() => onPreview(representative)}
                        onBlur={() => { if (!isSelected) onPreview(null); }}
                        onClick={() => onActivate(isSelected ? null : activity)}
                        className={`relative grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 overflow-hidden rounded-[var(--radius-sm)] border px-3 py-2 text-left text-xs transition-colors hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] aria-pressed:border-[var(--color-primary)] aria-pressed:ring-1 aria-pressed:ring-[var(--color-primary)] ${style.shell}`}>
                        <Icon aria-hidden="true" className="size-4" />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">
                            <span>{style.label}</span>
                            <span className="font-medium text-[var(--color-text-secondary)]">
                              {activity.from.timestamp}–{activity.to.timestamp}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[var(--color-text-secondary)]">{activity.address}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className={`rounded-full px-2 py-1 font-semibold ${style.badge}`}>{speedLabel}</span>
                          <FiChevronRight aria-hidden="true" className="size-4 text-[var(--color-text-secondary)]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <EndpointButton label="Финиш поездки" date={date} time={trip.finish.timestamp}
                  address={trip.finish.address} onClick={() => onEndpointActivate(trip.tripId, 'finish')} />
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}

function EndpointButton({ label, date, time, address, onClick }: {
  label: string; date: string; time: string; address: string; onClick: () => void;
}) {
  return (
    <button type="button" aria-label={`${label} ${date}, ${time}, ${address}`} onClick={onClick}
      className="grid min-h-11 gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
      <span className="font-semibold text-[var(--color-text)]">{label}</span>
      <span>{time} {address}</span>
    </button>
  );
}

function getRepresentativeSegment(activity: VehicleTrackActivitySection): VehicleTrackSegment {
  if (activity.kind !== 'speeding') return activity.segments[0];
  return activity.segments.reduce((fastest, segment) => segment.speedKph > fastest.speedKph ? segment : fastest);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} ч ${remainder} мин` : `${hours} ч`;
}
