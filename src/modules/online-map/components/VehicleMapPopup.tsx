import type { OnlineMapVehicle } from '../types';

export function VehicleMapPopup({ vehicle }: { vehicle: OnlineMapVehicle }) {
  const speedLabel =
    vehicle.gpsStatus.key === 'NO_DATA' || vehicle.gpsStatus.key === 'STALE'
      ? 'Нет актуальных данных'
      : vehicle.speedKph === 0
        ? 'Стоит'
        : `${vehicle.speedKph} км/ч`;

  return (
    <article
      aria-label={`Автомобиль ${vehicle.plate}`}
      className="grid max-w-72 min-w-60 gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-3 text-xs text-[var(--color-text)] shadow-[var(--shadow-floating)]"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block truncate text-[13px] leading-4">{vehicle.name}</strong>
          <span className="mt-0.5 block font-semibold tabular-nums">{vehicle.plate}</span>
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-[var(--color-text-secondary)]">
          {vehicle.gpsStatus.label}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--color-border)] pt-2">
        <div>
          <dt className="text-[10px] text-[var(--color-text-muted)]">Скорость</dt>
          <dd className="mt-0.5 font-semibold">{speedLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-[var(--color-text-muted)]">Топливо</dt>
          <dd className="mt-0.5 font-semibold">
            {vehicle.fuelPercent == null ? 'Нет данных' : `${vehicle.fuelPercent}%`}
          </dd>
        </div>
      </dl>

      <p className="text-[10px] text-[var(--color-text-secondary)]">
        Последний сигнал: {vehicle.lastSeenLabel}
      </p>
    </article>
  );
}
