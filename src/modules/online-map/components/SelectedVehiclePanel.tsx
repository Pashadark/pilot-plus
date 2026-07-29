import { FiClock, FiMapPin, FiTruck } from 'react-icons/fi';

import { EmptyState } from '@/shared/ui';

import type { OnlineMapStatus, OnlineMapVehicle } from '../types';

const statusLabels: Record<OnlineMapStatus, string> = {
  moving: 'В движении',
  idle: 'На стоянке',
  offline: 'Нет связи',
};

const statusClasses: Record<OnlineMapStatus, string> = {
  moving: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  idle: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  offline: 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
};

export interface SelectedVehiclePanelProps {
  vehicle: OnlineMapVehicle | null;
  className?: string;
}

export function SelectedVehiclePanel({ vehicle, className = '' }: SelectedVehiclePanelProps) {
  return (
    <aside
      aria-label="Выбранный автомобиль"
      className={`overflow-y-auto border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)] shadow-[var(--shadow-floating)] ${className}`}
    >
      {!vehicle ? (
        <EmptyState
          title="Автомобиль не выбран"
          description="Выберите маркер на карте или измените фильтры."
        />
      ) : (
        <article className="grid gap-4">
          <header className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiTruck aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{vehicle.name}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{vehicle.plate}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[vehicle.status]}`}
            >
              {statusLabels[vehicle.status]}
            </span>
          </header>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
              <dt className="text-[var(--color-text-secondary)]">Скорость</dt>
              <dd className="mt-1 font-semibold">{vehicle.speedKph} км/ч</dd>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
              <dt className="text-[var(--color-text-secondary)]">Топливо</dt>
              <dd className="mt-1 font-semibold">{vehicle.fuelPercent}%</dd>
            </div>
          </dl>

          <div className="grid gap-3 text-sm">
            <p className="flex gap-2 text-[var(--color-text-secondary)]">
              <FiMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{vehicle.address}</span>
            </p>
            <p className="flex gap-2 text-[var(--color-text-secondary)]">
              <FiClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>Связь: {vehicle.lastSeenLabel}</span>
            </p>
          </div>
        </article>
      )}
    </aside>
  );
}
