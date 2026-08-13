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
      client: { select: { firstName: true, middleName: true, lastName: true } },
      vehicle: { select: { make: true, modelName: true, registrationNumber: true } },
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function listRentalsForCurrentUser() {
  const access = await (await import('./access')).getRentalAccess();
  if (!access) throw new (await import('./access')).RentalAccessDeniedError();
  const where = access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } };
  return prisma.rental.findMany({
    where,
    select: {
      id: true,
      companyId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      contractNumber: true,
      totalPriceMinor: true,
      currency: true,
      createdAt: true,
      client: { select: { firstName: true, middleName: true, lastName: true } },
      vehicle: { select: { make: true, modelName: true, registrationNumber: true } },
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getRentalDetailForCurrentUser(id: string) {
  const access = await (await import('./access')).getRentalAccess();
  if (!access) throw new (await import('./access')).RentalAccessDeniedError();
  return prisma.rental.findFirst({
    where: {
      id,
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
    },
    include: {
      client: { select: { firstName: true, middleName: true, lastName: true } },
      vehicle: { select: { make: true, modelName: true, registrationNumber: true } },
      documentVersions: { select: { version: true, format: true }, orderBy: { version: 'desc' } },
    },
  });
}
