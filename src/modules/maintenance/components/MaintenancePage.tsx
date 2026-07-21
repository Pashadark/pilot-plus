import { FiTool } from 'react-icons/fi';

import type { MaintenanceRecordDto } from '../server/queries';
import type { VehicleOptionDto } from '@/modules/vehicles/types';

import { MaintenanceWorkspace } from './MaintenanceWorkspace';

export function MaintenancePage({
  records,
  vehicles,
}: {
  records: readonly MaintenanceRecordDto[];
  vehicles: readonly VehicleOptionDto[];
}) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="maintenance-page">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
            <FiTool aria-hidden="true" /> Сервис Pilot+
          </p>
          <h1 className="text-2xl font-bold tracking-tight break-words text-[var(--color-text)] sm:text-3xl">
            Техническое обслуживание
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Планируйте регламентные работы, отслеживайте сроки и фиксируйте завершение ТО.
          </p>
        </div>
      </header>
      <MaintenanceWorkspace records={records} vehicles={vehicles} />
    </main>
  );
}
