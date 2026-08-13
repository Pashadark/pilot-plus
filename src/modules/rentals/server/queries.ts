import 'server-only';

import { prisma } from '@/database/prisma/client';

import { requireRentalAccess } from './access';

export async function listRentalsForCompany(companyId: string) {
  await requireRentalAccess(companyId);
  return prisma.rental.findMany({
    where: { companyId },
    select: {
      id: true,
      clientId: true,
      vehicleId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      contractNumber: true,
      totalPriceMinor: true,
      currency: true,
      createdAt: true,
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  });
}
