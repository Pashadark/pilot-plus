'use client';

import { FiChevronLeft, FiChevronRight, FiDroplet, FiNavigation, FiSearch } from 'react-icons/fi';

import { filterOnlineMapVehicles } from '../filter-vehicles';
import type { OnlineMapFilter, OnlineMapVehicle } from '../types';

const FILTERS: readonly { value: OnlineMapFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'moving', label: 'В движении' },
  { value: 'idle', label: 'Стоит' },
  { value: 'in-park', label: 'В парке' },
  { value: 'offline', label: 'Давно' },
  { value: 'no-data', label: 'Нет связи' },
];

const STATUS_DOT: Record<OnlineMapVehicle['gpsStatus']['tone'], string> = {
  success: 'bg-[var(--color-success)]',
  primary: 'bg-[var(--color-primary)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  muted: 'bg-[var(--color-text-secondary)]',
};

export interface FleetVehicleRailProps {
  vehicles: readonly OnlineMapVehicle[];
  selectedVehicleId: string | null;
  query: string;
  filter: OnlineMapFilter;
  collapsed: boolean;
  onSelect: (vehicle: OnlineMapVehicle) => void;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: OnlineMapFilter) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  className?: string;
}

export function FleetVehicleRail({
  vehicles,
  selectedVehicleId,
  query,
  filter,
  collapsed,
  onSelect,
  onQueryChange,
  onFilterChange,
  onCollapsedChange,
  className = '',
}: FleetVehicleRailProps) {
  const filteredVehicles = filterOnlineMapVehicles(vehicles, query, filter);

  if (collapsed) {
    return (
      <aside
        aria-label="Автомобили"
        className={`flex w-16 flex-col items-center gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-floating)] ${className}`}
      >
        <button
          type="button"
          aria-label="Развернуть список автомобилей"
          onClick={() => onCollapsedChange(false)}
          className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <FiChevronRight aria-hidden="true" />
        </button>
        <span className="text-center text-xs font-semibold text-[var(--color-text-secondary)]">
          {filteredVehicles.length} авто
        </span>
        <div className="grid gap-2" aria-hidden="true">
          {filteredVehicles.slice(0, 7).map((vehicle) => (
            <span
              key={vehicle.id}
              className={`size-2.5 rounded-full ${STATUS_DOT[vehicle.gpsStatus.tone]}`}
            />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Автомобили"
      className={`flex min-h-0 w-[22.5rem] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-floating)] ${className}`}
    >
      <header className="border-b border-[var(--color-border)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Автопарк</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {filteredVehicles.length} из {vehicles.length} машин
            </p>
          </div>
          <button
            type="button"
            aria-label="Свернуть список автомобилей"
            onClick={() => onCollapsedChange(true)}
            className="grid size-11 place-items-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
        </div>

        <label className="relative block">
          <span className="sr-only">Поиск автомобиля</span>
          <FiSearch
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-text-secondary)]"
          />
          <input
            type="search"
            aria-label="Поиск автомобиля"
            placeholder="Модель, номер, водитель"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] pr-3 pl-10 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
          />
        </label>

        <div
          role="group"
          aria-label="Фильтр автомобилей"
          className="scrollbar-hidden mt-3 flex gap-2 overflow-x-auto"
        >
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => onFilterChange(item.value)}
              className="min-h-9 shrink-0 rounded-full border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)] aria-pressed:text-[var(--color-primary)]"
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredVehicles.length === 0 ? (
          <div className="p-5 text-center text-sm text-[var(--color-text-secondary)]">
            Машины не найдены. Измените поиск или фильтр.
          </div>
        ) : (
          <ul className="grid gap-1.5">
            {filteredVehicles.map((vehicle) => {
              const selected = vehicle.id === selectedVehicleId;
              return (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    aria-label={`Выбрать ${vehicle.name} ${vehicle.plate}`}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(vehicle)}
                    className="group relative grid min-h-24 w-full grid-cols-[1fr_auto] gap-x-3 gap-y-2 overflow-hidden rounded-[var(--radius-md)] border border-transparent p-3 text-left transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] aria-current:border-[var(--color-primary)] aria-current:bg-[var(--color-primary-soft)]"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${selected ? 'bg-[var(--color-primary)]' : STATUS_DOT[vehicle.gpsStatus.tone]}`}
                    />
                    <span className="min-w-0 pl-1">
                      <span className="block truncate text-sm font-semibold">{vehicle.name}</span>
                      <span className="mt-0.5 block text-xs font-medium text-[var(--color-text-secondary)]">
                        {vehicle.plate}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
                      <FiNavigation aria-hidden="true" />
                      {vehicle.gpsStatus.key === 'NO_DATA' || vehicle.gpsStatus.key === 'STALE'
                        ? 'Нет актуальных данных'
                        : vehicle.speedKph === 0
                          ? 'Стоит'
                          : `${vehicle.speedKph} км/ч`}
                    </span>
                    <span className="min-w-0 pl-1 text-xs text-[var(--color-text-secondary)]">
                      <span className="block truncate">
                        {vehicle.currentRental?.clientName ?? 'Нет активного водителя'}
                      </span>
                      <span className="mt-1 block truncate">{vehicle.lastSeenLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 self-end text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
                      <FiDroplet aria-hidden="true" />
                      {vehicle.fuelPercent == null ? '—' : `${Math.round(vehicle.fuelPercent)}%`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
