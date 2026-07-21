import { notFound } from 'next/navigation';

import { requireAdmin } from '@/modules/auth/dal';
import {
  isE2EErrorSeamEnabled,
  isValidE2EErrorId,
  triggerE2EErrorOnce,
} from '@/modules/system-states/e2e-error-seam';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function E2EErrorBoundaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  if (!isE2EErrorSeamEnabled(process.env)) notFound();

  const idValue = (await searchParams).id;
  const id = typeof idValue === 'string' ? idValue : undefined;
  if (!isValidE2EErrorId(id)) notFound();

  triggerE2EErrorOnce(id);

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Тест восстановления' }]}>
      <section className="grid min-h-[22rem] place-items-center p-4 text-center sm:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--color-primary)] uppercase">
            E2E
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Раздел восстановлен
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Повторный рендер завершился успешно.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
