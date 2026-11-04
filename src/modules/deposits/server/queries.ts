import 'server-only';

import { prisma } from '@/database/prisma/client';
import { getRentalAccess, type RentalAccess } from '@/modules/rentals/server/access';

import { buildDepositWorkspace } from '../workspace/model';

export async function getDepositWorkspace(
  providedAccess?: RentalAccess | null,
  referenceTime = new Date(),
) {
  const access = providedAccess === undefined ? await getRentalAccess() : providedAccess;
  if (!access) return buildDepositWorkspace([], referenceTime);
  const rentals = await prisma.rental.findMany({
    where: {
      ...(access.scope === 'COMPANY' ? { companyId: { in: [...access.companyIds] } } : {}),
      OR: [{ depositMinor: { gt: 0n } }, { depositLedgerEntries: { some: {} } }],
    },
    orderBy: [{ completedAt: 'desc' }, { endsAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      companyId: true,
      contractNumber: true,
      status: true,
      endsAt: true,
      completedAt: true,
      depositMinor: true,
      currency: true,
      client: {
        select: { id: true, firstName: true, middleName: true, lastName: true },
      },
      vehicle: {
        select: {
          make: true,
          model: true,
          modelName: true,
          registrationNumber: true,
        },
      },
      depositLedgerEntries: {
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          kind: true,
          reason: true,
          cashDeltaMinor: true,
          reservedDeltaMinor: true,
          withheldDeltaMinor: true,
          debtDeltaMinor: true,
          occurredAt: true,
        },
      },
    },
  });
  return buildDepositWorkspace(rentals, referenceTime);
}
