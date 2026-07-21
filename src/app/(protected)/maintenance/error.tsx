'use client';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Button, safeErrorReference, SystemState } from '@/shared/ui';

export default function MaintenanceError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Техническое обслуживание' }]}>
      <main className="p-4 sm:p-6">
        <SystemState
          code="500"
          tone="danger"
          title="Не удалось загрузить техническое обслуживание"
          description="Произошла непредвиденная ошибка. Повторите попытку — если она сохранится, передайте службе поддержки код обращения."
          reference={safeErrorReference(error)}
          primaryAction={<Button onClick={unstable_retry}>Повторить</Button>}
        />
      </main>
    </AppShell>
  );
}
