'use client';

import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Button, ErrorState, safeErrorReference } from '@/shared/ui';

export default function OnlineMapError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const reference = safeErrorReference(error);

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Онлайн-карта' }]}>
      <main className="-m-4 grid h-[calc(100dvh-var(--header-height))] place-items-center p-4 lg:-m-5">
        <div className="w-full max-w-xl">
          <ErrorState
            title="Не удалось загрузить онлайн-карту"
            description={`Повторите попытку. Если ошибка сохранится, передайте службе поддержки код обращения: ${reference}.`}
            action={<Button onClick={unstable_retry}>Повторить</Button>}
          />
        </div>
      </main>
    </AppShell>
  );
}
