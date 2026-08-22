'use client';

import { useMemo, useState } from 'react';
import { FiTruck } from 'react-icons/fi';
import Link from 'next/link';

import { filterVehicles, initialVehicleFilters } from '../filter';
import { deriveVehicleGpsStatus } from '../gps-status';
import type { VehicleCardDto } from '../types';
import { useMinuteNow } from '../use-minute-now';
import { VehicleFilters } from './VehicleFilters';
import { VehicleGrid } from './VehicleGrid';
import { Badge } from '@/shared/ui';
import { FleetImportDialog } from '@/modules/vehicles/manage/components/FleetImportDialog';

export function VehicleListPage({
  vehicles,
  manageableCompanies = [],
}: {
  vehicles: readonly VehicleCardDto[];
  manageableCompanies?: readonly { id: string; label: string; canArchive: boolean }[];
}) {
  const [filters, setFilters] = useState(initialVehicleFilters);
  const minuteNow = useMinuteNow();
  const liveVehicles = useMemo(
    () =>
      minuteNow === null
        ? vehicles
        : vehicles.map((vehicle) => ({
            ...vehicle,
            gpsStatus: deriveVehicleGpsStatus(
              {
                recordedAt: vehicle.telemetry.lastSeenAt,
                speedKph: vehicle.telemetry.speedKph,
                address: vehicle.telemetry.address,
                hasCoordinates: vehicle.telemetry.hasPosition,
              },
              minuteNow,
            ),
          })),
    [minuteNow, vehicles],
  );
  const filtered = useMemo(() => filterVehicles(liveVehicles, filters), [filters, liveVehicles]);
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary" className="min-h-8 px-3 text-sm" data-testid="vehicle-count">
            Показано {filtered.length} из {liveVehicles.length}
          </Badge>
          {manageableCompanies.length > 0 ? (
            <>
              <Link
                href={
                  manageableCompanies.length === 1
                    ? `/vehicles/new?companyId=${encodeURIComponent(manageableCompanies[0]?.id ?? '')}`
                    : '/vehicles/new'
                }
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                Добавить автомобиль
              </Link>
              <FleetImportDialog companies={manageableCompanies} />
            </>
          ) : null}
        </div>
      </header>
      <VehicleFilters
        filters={filters}
        vehicles={liveVehicles}
        onChange={setFilters}
        onReset={reset}
      />
      <VehicleGrid vehicles={filtered} onReset={reset} />
    </main>
  );
}
