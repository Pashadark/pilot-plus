'use client';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Button, safeErrorReference, SystemState } from '@/shared/ui';

export default function EventsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'История событий' }]}>
      <main className="p-4 sm:p-6">
        <SystemState
          code="500"
          tone="danger"
          title="Не удалось загрузить историю событий"
          description="Повторите попытку. Если ошибка сохранится, передайте службе поддержки код обращения."
          reference={safeErrorReference(error)}
          primaryAction={<Button onClick={unstable_retry}>Повторить</Button>}
        />
      </main>
    </AppShell>
  );
}
