'use client';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { ErrorState } from '@/shared/ui';
export default function Error() {
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Аренда' }]}>
      <main className="p-4 sm:p-6">
        <ErrorState title="Аренда временно недоступна" description="Повторите попытку." />
      </main>
    </AppShell>
  );
}
