'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

import { FilterChip, SearchInput } from '@/shared/ui';

import { VehicleSummary } from './DashboardPanels';
import { FleetMapClient } from './FleetMapClient';
import type { Vehicle, VehicleStatus } from './types';

type ActiveFilter = 'all' | 'moving' | 'alarm';
type SheetSnap = 'collapsed' | 'intermediate' | 'expanded';

const filters: readonly { value: ActiveFilter; label: string; status?: VehicleStatus }[] = [
  { value: 'all', label: 'Все автомобили' },
  { value: 'moving', label: 'В движении', status: 'moving' },
  { value: 'alarm', label: 'Тревоги', status: 'alarm' },
];

export function MobileFleetWorkspace({ vehicles }: { vehicles: readonly Vehicle[] }) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(vehicles[0] ?? null);
  const [snap, setSnap] = useState<SheetSnap>('collapsed');
  const dragStart = useRef<{ y: number; snap: SheetSnap } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { y: event.clientY, snap };
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const delta = event.clientY - start.y;
    const order: readonly SheetSnap[] = ['collapsed', 'intermediate', 'expanded'];
    const current = order.indexOf(start.snap);
    const steps = Math.abs(delta) > 220 ? 2 : Math.abs(delta) > 55 ? 1 : 0;
    setSnap(order[Math.max(0, Math.min(2, current + (delta > 0 ? -steps : steps)))]);
  };

  useEffect(() => {
    const synchronization = window.setTimeout(() => {
      setSelectedVehicle(
        (current) => vehicles.find((vehicle) => vehicle.id === current?.id) ?? vehicles[0] ?? null,
      );
    });
    return () => window.clearTimeout(synchronization);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
    const filter = filters.find((item) => item.value === activeFilter);
    return vehicles.filter(
      (vehicle) =>
        (!filter?.status || vehicle.status === filter.status) &&
        (!normalizedQuery ||
          `${vehicle.name} ${vehicle.plate}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery)),
    );
  }, [activeFilter, query, vehicles]);

  return (
    <section
      data-testid="mobile-map-workspace"
      aria-label="Мобильная карта автопарка"
      className="relative h-[calc(100dvh-var(--header-height))] min-h-[620px] overflow-hidden md:hidden"
    >
      <FleetMapClient
        vehicles={filteredVehicles}
        mode="mobile"
        onVehicleSelect={setSelectedVehicle}
      />
      <SearchInput
        aria-label="Поиск транспорта"
        placeholder="Найти автомобиль"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className="absolute top-4 right-4 left-4 z-20 bg-[var(--color-surface)] shadow-[var(--shadow-floating)]"
      />
      <div className="absolute top-16 right-4 left-4 z-20 flex gap-2 overflow-x-auto py-2">
        {filters.map((filter) => (
          <FilterChip
            key={filter.value}
            selected={activeFilter === filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className="shrink-0 bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
          >
            {filter.label}
          </FilterChip>
        ))}
      </div>
      <aside
        data-testid="vehicle-bottom-sheet"
        data-snap={snap}
        aria-label="Выбранный автомобиль"
        className={`absolute right-0 bottom-0 left-0 z-20 flex max-h-[calc(100%-0.5rem)] flex-col overflow-hidden rounded-t-[var(--radius-panel)] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-floating)] transition-[height] ${snap === 'collapsed' ? 'h-[28dvh]' : snap === 'intermediate' ? 'h-[60dvh]' : 'h-[90dvh]'}`}
      >
        <button
          type="button"
          data-testid="vehicle-sheet-handle"
          aria-label="Перетащить нижнюю панель"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="mx-auto mb-2 grid min-h-11 w-20 touch-none place-items-center"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-12 rounded-full bg-[var(--color-border-strong)]"
          />
        </button>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Выбранный автомобиль</h2>
          <div role="group" aria-label="Положение нижней панели" className="flex gap-1">
            {(['collapsed', 'intermediate', 'expanded'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-label={
                  value === 'collapsed'
                    ? 'Свернуть панель'
                    : value === 'intermediate'
                      ? 'Открыть панель наполовину'
                      : 'Развернуть панель'
                }
                aria-pressed={snap === value}
                onClick={() => setSnap(value)}
                className="min-h-11 min-w-11 rounded-[var(--radius-sm)] px-2 aria-pressed:bg-[var(--color-primary-soft)]"
              >
                {value === 'collapsed' ? '−' : value === 'intermediate' ? '½' : '↑'}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto">
          <VehicleSummary vehicle={selectedVehicle ?? vehicles[0]} />
        </div>
      </aside>
    </section>
  );
}
