import { FiTool } from 'react-icons/fi';

import type { MaintenanceRecordDto, RepairRentalOptionDto } from '../server/queries';
import type { VehicleOptionDto } from '@/modules/vehicles/types';

import { MaintenanceWorkspace } from './MaintenanceWorkspace';

export function MaintenancePage({
  records,
  vehicles,
  rentals,
}: {
  records: readonly MaintenanceRecordDto[];
  vehicles: readonly VehicleOptionDto[];
  rentals: readonly RepairRentalOptionDto[];
}) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="maintenance-page">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
            <FiTool aria-hidden="true" /> Сервис СУПА ПРО
          </p>
          <h1 className="text-2xl font-bold tracking-tight break-words text-[var(--color-text)] sm:text-3xl">
            Техническое обслуживание
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Планируйте ТО, фиксируйте повреждения и храните полную историю ремонтов.
          </p>
        </div>
      </header>
      <MaintenanceWorkspace records={records} vehicles={vehicles} rentals={rentals} />
    </main>
  );
}
