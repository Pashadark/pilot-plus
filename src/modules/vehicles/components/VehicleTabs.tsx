import Link from 'next/link';

import { vehicleTabs, type VehicleTab } from './vehicle-tabs';

export function VehicleTabs({ vehicleId, activeTab }: { vehicleId: string; activeTab: VehicleTab }) {
  return (
    <nav aria-label="Разделы автомобиля" className="overflow-x-auto border-b border-[var(--color-border)]">
      <ul className="flex min-w-max gap-1 px-1">
        {vehicleTabs.map((tab) => (
          <li key={tab.value}>
            <Link
              href={tab.value === 'overview' ? `/vehicles/${vehicleId}` : `/vehicles/${vehicleId}?tab=${tab.value}`}
              aria-current={tab.value === activeTab ? 'page' : undefined}
              className="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] aria-[current=page]:border-[var(--color-primary)] aria-[current=page]:text-[var(--color-primary)]"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
