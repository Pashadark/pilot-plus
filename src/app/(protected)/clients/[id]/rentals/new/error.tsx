'use client';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Button, safeErrorReference, SystemState } from '@/shared/ui';

export default function NewRentalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <AppShell
      breadcrumbs={[
        { label: 'СУПА ПРО', href: '/' },
        { label: 'Клиенты', href: '/clients' },
        { label: 'Новый договор' },
      ]}
    >
      <main className="p-4 sm:p-6">
        <SystemState
          code="500"
          tone="danger"
          title="Не удалось открыть новый договор"
          description="Повторите попытку. Если ошибка сохранится, передайте поддержке код обращения."
          reference={safeErrorReference(error)}
          primaryAction={<Button onClick={unstable_retry}>Повторить</Button>}
        />
      </main>
    </AppShell>
  );
}
