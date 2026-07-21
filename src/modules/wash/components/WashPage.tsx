import { FiDroplet } from 'react-icons/fi';

import type { LatestCompletedWashDto, WashRecordDto } from '../server/queries';
import type { VehicleOptionDto } from '@/modules/vehicles/types';

import { WashWorkspace } from './WashWorkspace';

export function WashPage({
  records,
  vehicles,
  latestCompletedWashes,
}: {
  records: readonly WashRecordDto[];
  vehicles: readonly VehicleOptionDto[];
  latestCompletedWashes: readonly LatestCompletedWashDto[];
}) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="wash-page">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
            <FiDroplet aria-hidden="true" /> Чистый автопарк Pilot+
          </p>
          <h1 className="text-2xl font-bold tracking-tight break-words text-[var(--color-text)] sm:text-3xl">
            Мойка автомобилей
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Планируйте мойки, контролируйте очередь и отмечайте готовые к работе автомобили.
          </p>
        </div>
      </header>
      <WashWorkspace
        records={records}
        vehicles={vehicles}
        latestCompletedWashes={latestCompletedWashes}
      />
    </main>
  );
}
