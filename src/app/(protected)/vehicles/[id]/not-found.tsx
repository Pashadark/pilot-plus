import Link from 'next/link';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { SystemState } from '@/shared/ui';

const fleetLinkClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

export default function VehicleNotFound() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Автомобили', href: '/vehicles' },
        { label: 'Не найден' },
      ]}
    >
      <main className="p-4 sm:p-6">
        <SystemState
          code="404"
          tone="warning"
          title="Автомобиль не найден"
          description="Запись не существует или недоступна вашей компании."
          primaryAction={
            <Link href="/vehicles" className={fleetLinkClass}>
              Вернуться к автопарку
            </Link>
          }
        />
      </main>
    </AppShell>
  );
}
