import { AppShell } from '@/shared/components/app-shell/AppShell';
import { SystemState } from '@/shared/ui';
export default function ClientNotFound() {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Клиенты', href: '/clients' },
      ]}
    >
      <main className="p-4 sm:p-6">
        <SystemState
          code="404"
          tone="warning"
          title="Клиент не найден"
          description="Карточка недоступна или была архивирована."
        />
      </main>
    </AppShell>
  );
}
