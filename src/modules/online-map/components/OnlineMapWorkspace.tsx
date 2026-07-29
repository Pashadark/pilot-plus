'use client';

import { useMemo, useState, type ComponentType, type ChangeEvent } from 'react';

import { Button, EmptyState, FilterChip, SearchInput } from '@/shared/ui';

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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const filteredVehicles = useMemo(
    () => filterOnlineMapVehicles(onlineMapVehicles, query, activeFilter),
    [activeFilter, query],
  );
  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const effectiveSelectedVehicleId = selectedVehicle?.id ?? null;

  const applyFilter = (nextQuery: string, nextFilter: OnlineMapFilter) => {
    const nextVehicles = filterOnlineMapVehicles(onlineMapVehicles, nextQuery, nextFilter);
    setSelectedVehicleId((current) =>
      nextVehicles.some((vehicle) => vehicle.id === current) ? current : null,
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

  const resetFilters = () => {
    setQuery('');
    setActiveFilter('all');
    setSelectedVehicleId(null);
  };

  return (
    <section
      aria-label="Онлайн-карта транспорта"
      className="@container relative h-[calc(100dvh-var(--header-height))] min-h-0 overflow-hidden bg-[var(--color-canvas)] [@media(max-height:42rem)]:[&_.maplibregl-ctrl-group]:hidden"
    >
      <div
        data-testid="online-map-controls"
        className="absolute top-3 right-3 left-3 z-20 grid gap-2 @min-[48rem]:right-auto @min-[48rem]:left-4 @min-[48rem]:w-[min(25rem,calc(100%-23rem))]"
      >
        <SearchInput
          aria-label="Поиск транспорта"
          placeholder="Поиск по модели или госномеру"
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

      {filteredVehicles.length === 0 && (
        <div className="absolute top-32 right-3 left-3 z-20 @min-[48rem]:right-auto @min-[48rem]:left-4 @min-[48rem]:w-[min(25rem,calc(100%-23rem))]">
          <EmptyState
            title="По запросу ничего не найдено"
            description="Сбросьте поиск и фильтр, чтобы снова увидеть весь автопарк."
            action={<Button onClick={resetFilters}>Сбросить фильтры</Button>}
          />
        </div>
      )}

      <div className="absolute inset-0">
        {filteredVehicles.length > 0 ? (
          <MapComponent
            vehicles={filteredVehicles}
            selectedVehicleId={effectiveSelectedVehicleId}
            onVehicleSelect={handleVehicleSelect}
          />
        ) : (
          <div className="h-full bg-[var(--color-canvas)]" aria-label="Карта без автомобилей" />
        )}
      </div>

      {selectedVehicle ? (
        <SelectedVehiclePanel
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicleId(null)}
          className="absolute right-0 bottom-0 left-0 z-20 max-h-[42dvh] rounded-t-[var(--radius-panel)] pb-[max(4rem,env(safe-area-inset-bottom))] @min-[48rem]:top-4 @min-[48rem]:right-4 @min-[48rem]:bottom-4 @min-[48rem]:left-auto @min-[48rem]:max-h-none @min-[48rem]:w-80 @min-[48rem]:rounded-[var(--radius-panel)] @min-[48rem]:pb-4"
        />
      ) : null}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 left-3 z-30 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2 text-xs font-medium text-[var(--color-text-secondary)] underline-offset-4 shadow-[var(--shadow-card)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        © OpenStreetMap
      </a>
    </section>
  );
}
