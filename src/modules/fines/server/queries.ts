import 'server-only';

import type { FineStatus, Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import { FineAccessDeniedError, getFineAccess } from '../access';

const statuses = new Set<FineStatus>(['NEW', 'UNPAID', 'PAID', 'CANCELLED', 'OVERDUE']);

export interface FineListFilters {
  status?: string;
  query?: string;
  companyId?: string;
}

export async function listFinesForCurrentUser(filters: FineListFilters) {
  const access = await getFineAccess();
  if (!access) throw new FineAccessDeniedError();

  const status =
    filters.status && statuses.has(filters.status as FineStatus)
      ? (filters.status as FineStatus)
      : undefined;
  const query = filters.query?.trim();
  const companyWhere =
    access.scope === 'SYSTEM'
      ? filters.companyId
        ? { companyId: filters.companyId }
        : {}
      : { companyId: { in: [...access.companyIds] } };
  const where: Prisma.FineWhereInput = {
    ...companyWhere,
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { decreeNumber: { contains: query, mode: 'insensitive' } },
            { vehicle: { registrationNumberNormalized: { contains: query } } },
            { client: { lastName: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const records = await prisma.fine.findMany({
    where,
    select: {
      id: true,
      decreeNumber: true,
      offenseAt: true,
      currentAmountMinor: true,
      originalAmountMinor: true,
      status: true,
      description: true,
      address: true,
      photoState: true,
      vehicleId: true,
      clientId: true,
      vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
      client: { select: { firstName: true, middleName: true, lastName: true } },
    },
    orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
    take: 200,
  });

  const fines = records.map((fine) => ({
    id: fine.id,
    decreeNumber: fine.decreeNumber,
    offenseAt: fine.offenseAt.toISOString(),
    currentAmountMinor: fine.currentAmountMinor.toString(),
    originalAmountMinor: fine.originalAmountMinor.toString(),
    status: fine.status,
    description: fine.description,
    address: fine.address,
    vehicleLabel: fine.vehicle
      ? [
          fine.vehicle.make,
          fine.vehicle.modelName ?? fine.vehicle.model,
          fine.vehicle.registrationNumber,
        ]
          .filter(Boolean)
          .join(' · ')
      : '',
    clientLabel: fine.client
      ? [fine.client.lastName, fine.client.firstName, fine.client.middleName]
          .filter(Boolean)
          .join(' ')
      : null,
    photoAvailable: fine.photoState === 'AVAILABLE',
    assigned: Boolean(fine.vehicleId && fine.clientId),
  }));
  const unpaid = fines.filter(({ status: itemStatus }) =>
    ['NEW', 'UNPAID', 'OVERDUE'].includes(itemStatus),
  );
  return {
    fines,
    summary: {
      newCount: fines.filter(({ status: itemStatus }) => itemStatus === 'NEW').length,
      unpaidCount: unpaid.length,
      unpaidAmountMinor: unpaid
        .reduce((total, fine) => total + BigInt(fine.currentAmountMinor), BigInt(0))
        .toString(),
      unassignedCount: fines.filter(({ assigned }) => !assigned).length,
    },
  };
}
