import { vehicleName } from '@/shared/lib/vehicle-name';
import 'server-only';

import { prisma } from '@/database/prisma/client';
import { canEditRental, getRentalAccess } from '@/modules/rentals/server/access';

import type { RentalEditDto } from '../rental-edit-types';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function moscowInput(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((out, part) => {
      out[part.type] = part.value;
      return out;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export async function getRentalEditForCurrentUser(id: string): Promise<RentalEditDto | null> {
  const access = await getRentalAccess();
  if (!access) return null;
  const rental = await prisma.rental.findFirst({
    where: {
      id,
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
    },
    select: {
      id: true,
      companyId: true,
      contractNumber: true,
      status: true,
      updatedAt: true,
      vehicleId: true,
      startsAt: true,
      endsAt: true,
      dailyRateMinor: true,
      discountMinor: true,
      servicesMinor: true,
      depositMinor: true,
      includedMileageKm: true,
      overageMileagePriceMinor: true,
      missingFuelPriceMinor: true,
      snapshot: true,
      vehicle: {
        select: {
          includedMileageKm: true,
          overageMileagePriceMinor: true,
          missingFuelPriceMinor: true,
        },
      },
      client: { select: { lastName: true, firstName: true, middleName: true } },
    },
  });
  if (!rental || !canEditRental(access, rental.companyId, rental.status)) return null;
  const vehicles = await prisma.vehicle.findMany({
    where: { companyId: rental.companyId, archivedAt: null, isDemoImport: false },
    select: {
      id: true,
      internalNumber: true,
      make: true,
      modelName: true,
      registrationNumber: true,
      dailyPriceMinor: true,
      depositMinor: true,
    },
    orderBy: [{ make: 'asc' }, { modelName: 'asc' }, { internalNumber: 'asc' }],
  });
  const snapshot =
    typeof rental.snapshot === 'object' && rental.snapshot && !Array.isArray(rental.snapshot)
      ? (rental.snapshot as Record<string, unknown>)
      : {};
  const issuance =
    typeof snapshot.issuance === 'object' && snapshot.issuance && !Array.isArray(snapshot.issuance)
      ? (snapshot.issuance as Record<string, unknown>)
      : {};
  return {
    id: rental.id,
    companyId: rental.companyId,
    contractNumber: rental.contractNumber,
    status: rental.status,
    clientLabel: [rental.client.lastName, rental.client.firstName, rental.client.middleName]
      .filter(Boolean)
      .join(' '),
    updatedAt: rental.updatedAt.toISOString(),
    vehicleId: rental.vehicleId,
    startsAt: moscowInput(rental.startsAt),
    endsAt: moscowInput(rental.endsAt),
    dailyRateRub: Number(rental.dailyRateMinor) / 100,
    discountRub: Number(rental.discountMinor) / 100,
    servicesRub: Number(rental.servicesMinor) / 100,
    depositRub: Number(rental.depositMinor ?? BigInt(0)) / 100,
    includedMileageKm: rental.includedMileageKm ?? rental.vehicle.includedMileageKm ?? 0,
    overageMileagePriceRub:
      Number(rental.overageMileagePriceMinor ?? rental.vehicle.overageMileagePriceMinor ?? 0) / 100,
    missingFuelPriceRub:
      Number(rental.missingFuelPriceMinor ?? rental.vehicle.missingFuelPriceMinor ?? 0) / 100,
    pickupAddress: text(issuance.pickupAddress),
    returnAddress: text(issuance.returnAddress),
    paymentTerms: text(issuance.paymentTerms),
    territory: text(issuance.territory),
    allowedDrivers: text(issuance.allowedDrivers),
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: [
        vehicleName(vehicle.make, vehicle.modelName),
        vehicle.registrationNumber,
        vehicle.internalNumber,
      ]
        .filter(Boolean)
        .join(' · '),
      dailyRateRub: vehicle.dailyPriceMinor / 100,
      depositRub: Number(vehicle.depositMinor ?? BigInt(0)) / 100,
    })),
  };
}
