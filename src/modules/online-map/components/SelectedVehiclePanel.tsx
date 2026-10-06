import type { ReactNode } from 'react';
import { FuelLevelBar } from '@/modules/vehicles/components/FuelLevelBar';
import { FiChevronDown, FiChevronUp, FiClock, FiMapPin, FiTruck, FiX } from 'react-icons/fi';

import { IconButton } from '@/shared/ui/IconButton';
import type { VehicleGpsStatusTone } from '@/modules/vehicles/gps-status';

import type { OnlineMapVehicle } from '../types';

const statusClasses: Record<VehicleGpsStatusTone, string> = {
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  muted: 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]',
};

export interface SelectedVehiclePanelProps {
  vehicle: OnlineMapVehicle;
  onClose: () => void;
  trackControls: ReactNode;
  trackSummary: ReactNode;
  trackSegments: ReactNode;
  trackEvents: ReactNode;
  mobileCollapsed?: boolean;
  onMobileCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export function SelectedVehiclePanel({
  vehicle,
  onClose,
  trackControls,
  trackSummary,
  trackSegments,
  trackEvents,
  mobileCollapsed = false,
  onMobileCollapsedChange = () => undefined,
  className = '',
}: SelectedVehiclePanelProps) {
  return (
    <aside
      data-testid="selected-vehicle-panel"
      data-mobile-collapsed={mobileCollapsed}
      aria-label="Выбранный автомобиль"
      className={`flex flex-col gap-3 overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)] shadow-[var(--shadow-floating)] ${className}`}
    >
      <header className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiTruck aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{vehicle.name}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{vehicle.plate}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[vehicle.gpsStatus.tone]}`}
            >
              {vehicle.gpsStatus.label}
            </span>
            <IconButton
              label={mobileCollapsed ? 'Развернуть карточку автомобиля' : 'Свернуть карточку автомобиля'}
              variant="ghost"
              size="sm"
              onClick={() => onMobileCollapsedChange(!mobileCollapsed)}
              className="-mt-1 shrink-0 @min-[48rem]:hidden"
            >
              {mobileCollapsed
                ? <FiChevronUp aria-hidden="true" className="size-5" />
                : <FiChevronDown aria-hidden="true" className="size-5" />}
            </IconButton>
            <IconButton
              label="Закрыть карточку автомобиля"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="-mt-1 -mr-1 shrink-0"
            >
              <FiX aria-hidden="true" className="size-5" />
            </IconButton>
      </header>

      <div className={`min-h-0 overflow-y-auto ${mobileCollapsed ? 'hidden @min-[48rem]:block' : ''}`}>
        <article className="grid gap-4">

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
              <dt className="text-[var(--color-text-secondary)]">Скорость</dt>
              <dd className="mt-1 font-semibold">
                {vehicle.gpsStatus.key === 'NO_DATA' || vehicle.gpsStatus.key === 'STALE'
                  ? 'Нет актуальных данных'
                  : vehicle.speedKph === 0
                    ? 'Стоит'
                    : `${vehicle.speedKph} км/ч`}
              </dd>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3">
              <dt className="text-[var(--color-text-secondary)]">Топливо</dt>
              <dd className="mt-1 font-semibold">
                <FuelLevelBar value={vehicle.fuelPercent} />
              </dd>
            </div>
          </dl>

          <div className="grid gap-3 text-sm">
            {vehicle.currentRental ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-3 text-[var(--color-text)]">
                Сейчас в аренде: <strong>{vehicle.currentRental.clientName}</strong>
                {vehicle.currentRental.contractNumber
                  ? <span className="mt-1 block">Договор {vehicle.currentRental.contractNumber}</span>
                  : ''}
              </p>
            ) : null}
            <p className="flex gap-2 text-[var(--color-text-secondary)]">
              <FiMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{vehicle.address}</span>
            </p>
            <p className="flex gap-2 text-[var(--color-text-secondary)]">
              <FiClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>Последний сигнал: {vehicle.lastSeenLabel}</span>
            </p>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">{trackControls}</div>
          {trackSummary}
          {trackSegments}
          {trackEvents}
        </article>
      </div>
    </aside>
  );
}
