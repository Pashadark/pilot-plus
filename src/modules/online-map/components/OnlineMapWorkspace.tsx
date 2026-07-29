'use client';

import { useMemo, useState, type ComponentType, type ChangeEvent } from 'react';

import { FilterChip, SearchInput } from '@/shared/ui';

import { onlineMapVehicles } from '../fixtures';
import { filterOnlineMapVehicles } from '../filter-vehicles';
import type { OnlineMapFilter, OnlineMapVehicle } from '../types';
import type { OnlineFleetMapProps } from './OnlineFleetMap';
import { OnlineFleetMapClient } from './OnlineFleetMapClient';
import { SelectedVehiclePanel } from './SelectedVehiclePanel';

const filters: readonly { value: OnlineMapFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'moving', label: 'В движении' },
  { value: 'idle', label: 'На стоянке' },
  { value: 'offline', label: 'Нет связи' },
];

export interface OnlineMapWorkspaceProps {
  mapComponent?: ComponentType<OnlineFleetMapProps>;
}

export function OnlineMapWorkspace({
  mapComponent: MapComponent = OnlineFleetMapClient,
}: OnlineMapWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<OnlineMapFilter>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    onlineMapVehicles[0]?.id ?? null,
  );

  const filteredVehicles = useMemo(
    () => filterOnlineMapVehicles(onlineMapVehicles, query, activeFilter),
    [activeFilter, query],
  );
  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    filteredVehicles[0] ??
    null;
  const effectiveSelectedVehicleId = selectedVehicle?.id ?? null;

  const applyFilter = (nextQuery: string, nextFilter: OnlineMapFilter) => {
    const nextVehicles = filterOnlineMapVehicles(onlineMapVehicles, nextQuery, nextFilter);
    setSelectedVehicleId((current) =>
      nextVehicles.some((vehicle) => vehicle.id === current)
        ? current
        : (nextVehicles[0]?.id ?? null),
    );
  };

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.currentTarget.value;
    setQuery(nextQuery);
    applyFilter(nextQuery, activeFilter);
  };

  const handleFilterChange = (nextFilter: OnlineMapFilter) => {
    setActiveFilter(nextFilter);
    applyFilter(query, nextFilter);
  };

  const handleVehicleSelect = (vehicle: OnlineMapVehicle) => {
    setSelectedVehicleId(vehicle.id);
  };

  return (
    <section
      aria-label="Онлайн-карта транспорта"
      className="relative h-[calc(100dvh-var(--header-height))] min-h-[36rem] overflow-hidden bg-[var(--color-canvas)]"
    >
      <div className="absolute inset-0">
        <MapComponent
          vehicles={filteredVehicles}
          selectedVehicleId={effectiveSelectedVehicleId}
          onVehicleSelect={handleVehicleSelect}
        />
      </div>

      <div className="absolute top-3 right-3 left-3 z-20 grid gap-2 md:right-auto md:left-4 md:w-[min(25rem,calc(100%-2rem))]">
        <SearchInput
          aria-label="Поиск транспорта"
          placeholder="Поиск по госномеру"
          value={query}
          onChange={handleQueryChange}
          className="shadow-[var(--shadow-card)]"
        />
        <div
          role="group"
          aria-label="Статус автомобилей"
          className="scrollbar-hidden flex gap-2 overflow-x-auto py-1"
        >
          {filters.map((filter) => (
            <FilterChip
              key={filter.value}
              selected={activeFilter === filter.value}
              onClick={() => handleFilterChange(filter.value)}
              className="shrink-0 bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
            >
              {filter.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <SelectedVehiclePanel
        vehicle={selectedVehicle}
        className="absolute right-0 bottom-0 left-0 z-20 max-h-[42dvh] rounded-t-[var(--radius-panel)] pb-[max(1rem,env(safe-area-inset-bottom))] md:top-4 md:right-4 md:bottom-4 md:left-auto md:max-h-none md:w-80 md:rounded-[var(--radius-panel)] md:pb-4"
      />
    </section>
  );
}
