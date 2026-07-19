import { FiMapPin, FiShield } from 'react-icons/fi';

import { Card, CardContent } from '@/shared/ui';
import { FlashToast, ToastProvider, type FlashToastKind } from '@/shared/providers/ToastProvider';

import { LoginForm } from './LoginForm';

export function LoginPage({ flash }: { flash: FlashToastKind | null }) {
  return (
    <ToastProvider>
      <FlashToast kind={flash} />
      <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[var(--color-canvas)] px-4 py-[max(2rem,env(safe-area-inset-top))] sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--color-primary-soft),transparent_42%)]"
        />
        <div className="relative grid w-full max-w-md gap-6">
          <header className="text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-xl font-extrabold text-[var(--color-text-inverse)] shadow-[var(--shadow-card)]">
              P+
            </div>
            <p className="text-sm font-semibold text-[var(--color-primary)]">PILOT+</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Вход в Pilot+</h1>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              Управление автопарком и телематикой
            </p>
          </header>

          <Card className="border-[var(--color-border-strong)]">
            <CardContent className="p-5 sm:p-7">
              <LoginForm />
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <FiShield aria-hidden="true" /> Защищённая сессия
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiMapPin aria-hidden="true" /> Телематика в реальном времени
            </span>
          </div>
        </div>
      </main>
    </ToastProvider>
  );
}
