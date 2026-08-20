import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { RentalWizardVehicle } from '@/modules/rentals/components/RentalWizard';

export async function listRentalDraftVehicleOptions(
  companyId: string,
): Promise<RentalWizardVehicle[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { companyId, archivedAt: null, isDemoImport: false },
    select: {
      id: true,
      make: true,
      modelName: true,
      model: true,
      registrationNumber: true,
      vin: true,
      dailyPriceMinor: true,
      isRentalReady: true,
      status: true,
      registrationCertificateNumber: true,
      vehiclePassportNumber: true,
      osagoInsurer: true,
      osagoPolicyNumber: true,
      osagoStartsAt: true,
      osagoEndsAt: true,
      cascoInsurer: true,
      cascoPolicyNumber: true,
      cascoStartsAt: true,
      cascoEndsAt: true,
      rentals: { select: { startsAt: true, endsAt: true, status: true } },
      washRecords: {
        where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        select: { id: true },
      },
    },
    orderBy: [{ make: 'asc' }, { model: 'asc' }],
  });

  return vehicles.map((vehicle) => {
    const reasons = [
      ...(vehicle.status === 'MAINTENANCE' ? ['Автомобиль на техническом обслуживании'] : []),
      ...(vehicle.washRecords.length ? ['Автомобиль на мойке'] : []),
    ];
    return {
      id: vehicle.id,
      label: [vehicle.make, vehicle.modelName ?? vehicle.model, vehicle.registrationNumber]
        .filter(Boolean)
        .join(' '),
      dailyMinor: vehicle.dailyPriceMinor,
      available: reasons.length === 0,
      reasons,
      legalReady: Boolean(
        vehicle.isRentalReady &&
        vehicle.registrationNumber &&
        vehicle.vin &&
        vehicle.registrationCertificateNumber &&
        vehicle.vehiclePassportNumber &&
        vehicle.osagoInsurer &&
        vehicle.osagoPolicyNumber &&
        vehicle.osagoStartsAt &&
        vehicle.osagoEndsAt &&
        vehicle.cascoInsurer &&
        vehicle.cascoPolicyNumber &&
        vehicle.cascoStartsAt &&
        vehicle.cascoEndsAt,
      ),
      rentalIntervals: vehicle.rentals.map((rental) => ({
        ...rental,
        startsAt: rental.startsAt.toISOString(),
        endsAt: rental.endsAt.toISOString(),
      })),
    };
  });
}
