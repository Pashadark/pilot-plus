import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  getVehicleManagementAccess,
  requireVehicleManagementAccess,
} from '@/modules/vehicles/manage/access';
import { VehicleForm } from '@/modules/vehicles/manage/components/VehicleForm';
import { prisma } from '@/database/prisma/client';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const access = await getVehicleManagementAccess();
  if (!access) notFound();
  const companies = await prisma.company.findMany({
    where: access.scope === 'SYSTEM' ? {} : { id: { in: [...access.companyIds] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (companies.length === 0) notFound();
  if (companyId) await requireVehicleManagementAccess(companyId);
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
        <VehicleForm
          companies={companies.map((company) => ({
            id: company.id,
            label: company.name,
            canArchive: false,
          }))}
        />
      </main>
    </AppShell>
  );
}
