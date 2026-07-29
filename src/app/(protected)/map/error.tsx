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
  const title = 'Не удалось загрузить онлайн-карту';
  const description = reference
    ? `Повторите попытку. Если ошибка сохранится, передайте сообщение службе поддержки. Код обращения: ${reference}.`
    : 'Повторите попытку. Если ошибка сохранится, обратитесь в службу поддержки.';

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Онлайн-карта' }]}>
      <main className="-m-4 grid h-[calc(100dvh-var(--header-height))] place-items-center p-4 lg:-m-5">
        <section role="alert" aria-labelledby="online-map-error-title" className="w-full max-w-xl">
          <h1 id="online-map-error-title" className="sr-only">
            {title}
          </h1>
          <ErrorState
            title={title}
            description={description}
            action={<Button onClick={unstable_retry}>Повторить</Button>}
          />
        </section>
      </main>
    </AppShell>
  );
}
