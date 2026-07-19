'use client';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Button, ErrorState } from '@/shared/ui';

export default function VehiclesError({ reset }: { reset: () => void }) {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Автомобили' }]}>
      <main className="p-4 sm:p-6">
        <ErrorState
          title="Не удалось загрузить автомобили"
          description="Проверьте подключение к базе данных и повторите попытку."
          action={<Button onClick={reset}>Повторить</Button>}
        />
      </main>
    </AppShell>
  );
}
