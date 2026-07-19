'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, SystemState } from '@/shared/ui';

const homeLinkClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-canvas)] p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <SystemState
          code="404"
          tone="primary"
          title="Страница не найдена"
          description="Проверьте адрес или вернитесь к работе с автопарком."
          primaryAction={
            <Link href="/" className={homeLinkClass}>
              На главную
            </Link>
          }
          secondaryAction={
            <Button variant="secondary" onClick={() => router.back()}>
              Назад
            </Button>
          }
        />
      </div>
    </main>
  );
}
