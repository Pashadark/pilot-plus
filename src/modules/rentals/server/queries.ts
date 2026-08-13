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

export type RentalListFilters = { status?: string; query?: string; from?: string; to?: string };
export async function listFilteredRentalsForCurrentUser(filters: RentalListFilters) {
  const access = await (await import('./access')).getRentalAccess();
  if (!access) throw new (await import('./access')).RentalAccessDeniedError();
  const query = filters.query?.trim();
  const statuses = ['DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
  return prisma.rental.findMany({
    where: {
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
      ...(filters.status && statuses.includes(filters.status)
        ? { status: filters.status as never }
        : {}),
      ...(filters.from ? { endsAt: { gte: new Date(`${filters.from}T00:00:00+03:00`) } } : {}),
      ...(filters.to ? { startsAt: { lte: new Date(`${filters.to}T23:59:59+03:00`) } } : {}),
      ...(query
        ? {
            OR: [
              { contractNumber: { contains: query, mode: 'insensitive' } },
              {
                client: {
                  is: {
                    OR: [
                      { firstName: { contains: query, mode: 'insensitive' } },
                      { lastName: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                vehicle: {
                  is: {
                    OR: [
                      { make: { contains: query, mode: 'insensitive' } },
                      { modelName: { contains: query, mode: 'insensitive' } },
                      { registrationNumber: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
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
