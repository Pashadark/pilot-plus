import Link from 'next/link';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { SystemState } from '@/shared/ui';

const devicesLinkClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

export default function DeviceNotFound() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Устройства', href: '/devices' },
        { label: 'Не найдено' },
      ]}
    >
      <main className="p-4 sm:p-6">
        <SystemState
          code="404"
          tone="warning"
          title="Устройство не найдено"
          description="Запись не существует или недоступна вашей компании."
          primaryAction={
            <Link href="/devices" className={devicesLinkClass}>
              Вернуться к устройствам
            </Link>
          }
        />
      </main>
    </AppShell>
  );
}
