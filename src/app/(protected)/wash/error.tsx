'use client';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { ErrorState } from '@/shared/ui';

export default function WashError() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Мойка' }]}>
      <main className="p-4 sm:p-6">
        <ErrorState title="Мойка временно недоступна" description="Повторите попытку." />
      </main>
    </AppShell>
  );
}
