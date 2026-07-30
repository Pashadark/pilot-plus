import { EmptyState } from '@/shared/ui';

import type { VehicleTrackPeriodViewModel } from '../track-types';

export function TrackDaySummary({ model }: { model: VehicleTrackPeriodViewModel | null }) {
  if (!model) {
    return (
      <EmptyState
        title="За эту дату поездок нет"
        description="Выберите другой день, чтобы посмотреть маршрут."
      />
    );
  }

  return (
    <section aria-labelledby="track-summary-title" className="grid gap-3">
      <h3 id="track-summary-title" className="font-semibold">
        Сводка маршрута
      </h3>
      {model.period === 'seven-days' ? (
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {model.trips.length} поездки
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Пробег" value={`${model.distanceKm.toFixed(1)} км`} />
        <Metric label="В пути" value={`${model.durationMinutes} мин`} />
        <Metric label="Макс. скорость" value={`${model.maxSpeedKph} км/ч`} />
        <Metric label="Стоянки" value={String(model.stopsCount)} />
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
