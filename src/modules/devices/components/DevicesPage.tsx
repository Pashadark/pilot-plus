import { FiCpu } from 'react-icons/fi';

import type { DevicePageData } from '../server/queries';

import { DevicesWorkspace } from './DevicesWorkspace';

export function DevicesPage({ data }: { data: DevicePageData }) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="devices-page">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
            <FiCpu aria-hidden="true" /> Pilot Connect
          </p>
          <h1 className="text-2xl font-bold tracking-tight break-words text-[var(--color-text)] sm:text-3xl">
            Устройства Pilot Connect
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
            Контролируйте связь, питание, спутники и версии прошивок автомобильных трекеров.
          </p>
        </div>
      </header>
      <DevicesWorkspace {...data} />
    </main>
  );
}
