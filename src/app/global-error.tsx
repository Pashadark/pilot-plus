'use client';

import { Button, safeErrorReference, SystemState } from '@/shared/ui';

import './globals.css';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ru">
      <head>
        <title>Ошибка — Pilot+</title>
      </head>
      <body>
        <main className="grid min-h-screen place-items-center bg-[var(--color-canvas)] p-4 sm:p-8">
          <div className="w-full max-w-3xl">
            <SystemState
              code="500"
              tone="danger"
              title="Сервис временно недоступен"
              description="Не удалось загрузить Pilot+. Повторите попытку — если ошибка сохранится, передайте службе поддержки код обращения."
              reference={safeErrorReference(error)}
              primaryAction={<Button onClick={unstable_retry}>Повторить</Button>}
            />
          </div>
        </main>
      </body>
    </html>
  );
}
