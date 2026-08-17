import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/database/prisma/client';
import { requireVehicleManagementAccess } from '@/modules/vehicles/manage/access';
import { VehicleForm } from '@/modules/vehicles/manage/components/VehicleForm';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      companyId: true,
      internalNumber: true,
      registrationNumber: true,
      make: true,
      modelName: true,
      manufacturedYear: true,
      vin: true,
      city: true,
      dailyPriceMinor: true,
      transmission: true,
      fuelType: true,
      seats: true,
      status: true,
      isRentalReady: true,
      company: { select: { name: true } },
    },
  });
  if (!vehicle) notFound();
  await requireVehicleManagementAccess(vehicle.companyId);
  if (
    !vehicle.registrationNumber ||
    !vehicle.make ||
    !vehicle.modelName ||
    !vehicle.manufacturedYear
  )
    notFound();

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Автомобили', href: '/vehicles' },
        { label: vehicle.modelName, href: `/vehicles/${vehicle.id}` },
        { label: 'Редактирование' },
      ]}
    >
      <main className="mx-auto grid w-full max-w-4xl gap-5 p-4 sm:p-6">
        <div>
          <Link
            href={`/vehicles/${vehicle.id}`}
            className="text-sm font-semibold text-[var(--color-primary)]"
          >
            ← К автомобилю
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Редактировать автомобиль
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Изменения сохраняются в журнале действий компании.
          </p>
        </div>
        <VehicleForm
          companies={[{ id: vehicle.companyId, label: vehicle.company.name, canArchive: true }]}
          vehicle={{
            id: vehicle.id,
            companyId: vehicle.companyId,
            internalNumber: vehicle.internalNumber,
            registrationNumber: vehicle.registrationNumber,
            make: vehicle.make,
            model: vehicle.modelName,
            year: vehicle.manufacturedYear,
            vin: vehicle.vin,
            city: vehicle.city,
            dailyPriceRubles: (vehicle.dailyPriceMinor / 100).toFixed(2),
            transmission: vehicle.transmission,
            fuelType: vehicle.fuelType,
            seats: vehicle.seats,
            status: vehicle.status,
            isRentalReady: vehicle.isRentalReady,
          }}
        />
      </main>
    </AppShell>
  );
}
