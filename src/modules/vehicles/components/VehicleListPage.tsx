'use client';

import { useMemo, useState } from 'react';
import { FiTruck } from 'react-icons/fi';

import { filterVehicles, initialVehicleFilters } from '../filter';
import type { VehicleCardDto } from '../types';
import { VehicleFilters } from './VehicleFilters';
import { VehicleGrid } from './VehicleGrid';
import { Badge } from '@/shared/ui';

export function VehicleListPage({ vehicles }: { vehicles: readonly VehicleCardDto[] }) {
  const [filters, setFilters] = useState(initialVehicleFilters);
  const filtered = useMemo(() => filterVehicles(vehicles, filters), [filters, vehicles]);
  const reset = () => setFilters(initialVehicleFilters);

  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="vehicle-list-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
            <FiTruck aria-hidden="true" /> Автопарк Pilot+
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            Автомобили
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Характеристики, статус и доступная телеметрия транспорта вашей компании.
          </p>
        </div>
        <Badge tone="primary" className="min-h-8 px-3 text-sm" data-testid="vehicle-count">
          Показано {filtered.length} из {vehicles.length}
        </Badge>
      </header>
      <VehicleFilters
        filters={filters}
        vehicles={vehicles}
        onChange={setFilters}
        onReset={reset}
      />
      <VehicleGrid vehicles={filtered} onReset={reset} />
    </main>
  );
}
