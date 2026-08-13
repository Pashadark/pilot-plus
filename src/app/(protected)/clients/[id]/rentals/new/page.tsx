import { notFound } from 'next/navigation';

import { prisma } from '@/database/prisma/client';
import { getAvailability } from '@/modules/rentals/domain/availability';
import { requireClientAccess } from '@/modules/clients/access';
import { getClientById } from '@/modules/clients/server/queries';
import { RentalWizard, type RentalWizardVehicle } from '@/modules/rentals/components/RentalWizard';
import { requireRentalAccess } from '@/modules/rentals/server/access';
import { AppShell } from '@/shared/components/app-shell/AppShell';

const reasonLabels: Record<string, string> = {
  ARCHIVED: 'Автомобиль в архиве',
  NOT_RENTAL_READY: 'Автомобиль не готов к аренде',
  MAINTENANCE: 'Автомобиль на техническом обслуживании',
  RENTAL_OVERLAP: 'Занят подтверждённой арендой',
  WASH: 'Автомобиль на мойке',
};

export default async function NewRentalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientAccess = await requireClientAccess('VIEW_CLIENTS');
  const client = await getClientById(clientAccess, id);
  if (!client) notFound();
  await requireRentalAccess(client.companyId);
  const [vehicles, template] = await Promise.all([
    prisma.vehicle.findMany({
      where: { companyId: client.companyId },
      select: {
        id: true,
        make: true,
        modelName: true,
        model: true,
        registrationNumber: true,
        dailyPriceMinor: true,
        archivedAt: true,
        isRentalReady: true,
        status: true,
        rentals: { select: { startsAt: true, endsAt: true, status: true } },
        washRecords: {
          where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
          select: { id: true },
        },
      },
      orderBy: [{ make: 'asc' }, { model: 'asc' }],
    }),
    prisma.contractTemplateVersion.findFirst({
      where: { companyId: client.companyId, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { id: true },
    }),
  ]);
  const vehicleOptions: RentalWizardVehicle[] = vehicles.map((vehicle) => {
    const availability = getAvailability(
      {
        archived: Boolean(vehicle.archivedAt),
        rentalReady: vehicle.isRentalReady,
        status: vehicle.status,
        rentals: [],
      },
      [new Date(0), new Date('9999-12-31T00:00:00.000Z')],
    );
    const reasons = [...availability.reasons, ...(vehicle.washRecords.length ? ['WASH'] : [])].map(
      (reason) => reasonLabels[reason],
    );
    return {
      id: vehicle.id,
      label: [vehicle.make, vehicle.modelName ?? vehicle.model, vehicle.registrationNumber]
        .filter(Boolean)
        .join(' '),
      dailyMinor: vehicle.dailyPriceMinor,
      available: reasons.length === 0,
      reasons,
      rentalIntervals: vehicle.rentals.map((rental) => ({
        ...rental,
        startsAt: rental.startsAt.toISOString(),
        endsAt: rental.endsAt.toISOString(),
      })),
    };
  });
  return (
    <AppShell
      breadcrumbs={[
        { label: 'Pilot+', href: '/' },
        { label: 'Клиенты', href: '/clients' },
        { label: client.fullName, href: `/clients/${client.id}` },
        { label: 'Новый договор' },
      ]}
    >
      <RentalWizard
        client={client}
        templateVersionId={template?.id ?? null}
        vehicles={vehicleOptions}
      />
    </AppShell>
  );
}
