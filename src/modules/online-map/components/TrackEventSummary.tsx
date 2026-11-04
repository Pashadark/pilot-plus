import { FiAlertTriangle, FiPauseCircle, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';

import type { TrackEventType, VehicleTrackPeriodViewModel } from '../track-types';

const ITEMS: ReadonlyArray<{
  type: TrackEventType;
  label: string;
  icon: typeof FiAlertTriangle;
  tone: string;
}> = [
  {
    type: 'speeding',
    label: 'Превышения',
    icon: FiAlertTriangle,
    tone: 'text-[var(--color-danger)]',
  },
  {
    type: 'harsh-acceleration',
    label: 'Разгоны',
    icon: FiTrendingUp,
    tone: 'text-[var(--color-warning)]',
  },
  {
    type: 'harsh-braking',
    label: 'Торможения',
    icon: FiTrendingDown,
    tone: 'text-[var(--color-primary)]',
  },
  {
    type: 'stop',
    label: 'Остановки',
    icon: FiPauseCircle,
    tone: 'text-[var(--color-text-secondary)]',
  },
];

export function TrackEventSummary({ model }: { model: VehicleTrackPeriodViewModel }) {
  return (
    <section aria-label="Сводка событий маршрута" className="grid grid-cols-4 gap-1.5">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const count = model.events.filter((event) => event.type === item.type).length;
        return (
          <div
            key={item.type}
            className="min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-2 text-center"
          >
            <Icon aria-hidden="true" className={`mx-auto size-4 ${item.tone}`} />
            <strong className="mt-1 block text-sm tabular-nums">{count}</strong>
            <span className="block truncate text-[9px] text-[var(--color-text-secondary)]">
              {item.label}
            </span>
          </div>
        );
      })}
    </section>
  );
}
