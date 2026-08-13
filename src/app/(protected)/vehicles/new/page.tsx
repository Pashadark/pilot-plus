import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireVehicleManagementAccess } from '@/modules/vehicles/manage/access';
import { VehicleForm } from '@/modules/vehicles/manage/components/VehicleForm';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  if (!companyId) notFound();
  await requireVehicleManagementAccess(companyId);
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Автомобили', href: '/vehicles' },
        { label: 'Добавить автомобиль' },
      ]}
    >
      <main className="mx-auto grid w-full max-w-4xl gap-5 p-4 sm:p-6">
        <div>
          <Link
            href="/vehicles"
            className="text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            ← К автопарку
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            Добавить автомобиль
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Поля со звёздочкой обязательны для сохранения.
          </p>
        </div>
        <VehicleForm companyId={companyId} />
      </main>
    </AppShell>
  );
}
