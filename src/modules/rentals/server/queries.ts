import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
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
      depositMinor: true,
      currency: true,
      createdAt: true,
      client: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      vehicle: { select: { id: true, make: true, modelName: true, registrationNumber: true } },
      operations: {
        where: { type: 'EXTENSION', status: 'COMMITTED' },
        select: { id: true },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      },
      documentVersions: {
        select: { format: true, version: true },
        orderBy: [{ version: 'desc' }, { format: 'asc' }],
        take: 2,
      },
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
      depositMinor: true,
      currency: true,
      createdAt: true,
      client: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      vehicle: { select: { id: true, make: true, modelName: true, registrationNumber: true } },
      operations: {
        where: { type: 'EXTENSION', status: 'COMMITTED' },
        select: { id: true },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      },
      documentVersions: {
        select: { format: true, version: true },
        orderBy: [{ version: 'desc' }, { format: 'asc' }],
        take: 2,
      },
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export type RentalListFilters = {
  status?: string;
  query?: string;
  vehicleId?: string;
  from?: string;
  to?: string;
  archive?: string;
  important?: string;
};

export function buildRentalVehicleFilter(filters: RentalListFilters) {
  const vehicleId = filters.vehicleId?.trim();
  return vehicleId || undefined;
}

export const rentalListSelect = {
  id: true,
  companyId: true,
  status: true,
  agreementType: true,
  startsAt: true,
  endsAt: true,
  completedAt: true,
  contractNumber: true,
  dailyRateMinor: true,
  totalPriceMinor: true,
  depositMinor: true,
  currency: true,
  createdAt: true,
  client: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phoneEncrypted: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      internalNumber: true,
      make: true,
      modelName: true,
      model: true,
      city: true,
      registrationNumber: true,
      images: {
        select: { localPath: true, alt: true },
        orderBy: [{ isPrimary: 'desc' as const }, { position: 'asc' as const }],
        take: 1,
      },
    },
  },
  payments: {
    where: { status: 'CONFIRMED' as const },
    select: { kind: true, amountMinor: true },
    orderBy: [{ recordedAt: 'asc' as const }, { id: 'asc' as const }],
  },
  operations: {
    where: { status: 'COMMITTED' as const },
    select: {
      id: true,
      type: true,
      occurredAt: true,
      nextEndsAt: true,
      depositStatus: true,
      depositWithheldMinor: true,
    },
    orderBy: [{ occurredAt: 'desc' as const }, { id: 'desc' as const }],
    take: 25,
  },
  documentVersions: {
    select: { format: true, version: true },
    orderBy: [{ version: 'desc' as const }, { format: 'asc' as const }],
    take: 2,
  },
} satisfies Prisma.RentalSelect;

const RENTAL_STATUSES = ['DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export function buildRentalArchiveStatusFilter(filters: RentalListFilters) {
  if (
    filters.status &&
    RENTAL_STATUSES.includes(filters.status as (typeof RENTAL_STATUSES)[number])
  ) {
    return filters.status as (typeof RENTAL_STATUSES)[number];
  }
  return filters.archive === '1'
    ? { in: ['COMPLETED', 'CANCELLED'] as const }
    : { notIn: ['COMPLETED', 'CANCELLED'] as const };
}
export function parseRentalListMoscowBoundary(
  value: string | undefined,
  nextDay = false,
): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000+03:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value;
  if (`${read('year')}-${read('month')}-${read('day')}` !== value) return null;
  return new Date(date.getTime() + (nextDay ? 86_400_000 : 0));
}
export async function listFilteredRentalsForCurrentUser(filters: RentalListFilters) {
  const access = await (await import('./access')).getRentalAccess();
  if (!access) throw new (await import('./access')).RentalAccessDeniedError();
  const query = filters.query?.trim();
  const vehicleId = buildRentalVehicleFilter(filters);
  const from = parseRentalListMoscowBoundary(filters.from);
  const toExclusive = parseRentalListMoscowBoundary(filters.to, true);
  return prisma.rental.findMany({
    where: {
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
      status: buildRentalArchiveStatusFilter(filters) as never,
      ...(vehicleId ? { vehicleId } : {}),
      ...(from ? { endsAt: { gt: from } } : {}),
      ...(toExclusive ? { startsAt: { lt: toExclusive } } : {}),
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
    select: rentalListSelect,
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getRentalDetailForCurrentUser(id: string) {
  const accessModule = await import('./access');
  const access = await accessModule.getRentalAccess();
  if (!access) throw new accessModule.RentalAccessDeniedError();
  const rental = await prisma.rental.findFirst({
    where: {
      id,
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
    },
    select: {
      id: true,
      companyId: true,
      clientId: true,
      vehicleId: true,
      contractNumber: true,
      status: true,
      agreementType: true,
      startsAt: true,
      endsAt: true,
      currency: true,
      dailyRateMinor: true,
      billableDays: true,
      basePriceMinor: true,
      discountMinor: true,
      servicesMinor: true,
      totalPriceMinor: true,
      depositMinor: true,
      includedMileageKm: true,
      overageMileagePriceMinor: true,
      missingFuelPriceMinor: true,
      priceOverrideReason: true,
      snapshot: true,
      createdAt: true,
      updatedAt: true,
      confirmedAt: true,
      activatedAt: true,
      completedAt: true,
      cancelledAt: true,
      client: {
        select: { id: true, firstName: true, middleName: true, lastName: true },
      },
      vehicle: {
        select: { id: true, make: true, modelName: true, registrationNumber: true },
      },
      drivers: {
        select: { id: true, snapshot: true },
        orderBy: { sortOrder: 'asc' },
      },
      documentVersions: {
        select: { version: true, format: true },
        orderBy: [{ version: 'desc' }, { format: 'asc' }],
      },
      documentGenerations: {
        select: {
          version: true,
          status: true,
          docxSha256: true,
          pdfSha256: true,
          updatedAt: true,
        },
        orderBy: { version: 'desc' },
        take: 5,
      },
      payments: {
        select: {
          id: true,
          kind: true,
          status: true,
          amountMinor: true,
          method: true,
          recordedAt: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { recordedAt: 'asc' },
      },
      signatures: {
        select: {
          party: true,
          status: true,
          signedByName: true,
          signedAt: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { party: 'asc' },
      },
      operations: {
        where: { status: 'COMMITTED' },
        select: {
          id: true,
          type: true,
          occurredAt: true,
          evidenceStatus: true,
          evidenceMissingReason: true,
          mileageKm: true,
          fuelLevelPercent: true,
          fulfillmentMethod: true,
          fulfillmentAddress: true,
          nextEndsAt: true,
          totalChargeMinor: true,
          depositAmountMinor: true,
          depositWithheldMinor: true,
          depositStatus: true,
          depositResolutionReason: true,
          actor: { select: { name: true } },
          media: {
            where: { status: 'CLEAN' },
            select: { kind: true, verifiedMime: true },
            orderBy: { kind: 'asc' },
          },
        },
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
        take: 100,
      },
      depositLedgerEntries: {
        where: { kind: 'DEPOSIT_RETURN' },
        select: { id: true },
        take: 1,
      },
    },
  });
  return rental
    ? {
        ...rental,
        canEdit: accessModule.canEditRental(access, rental.companyId, rental.status),
        canManageRegionalGeofence: accessModule.canManageRentalRegionalGeofence(
          access,
          rental.companyId,
        ),
      }
    : null;
}

export async function listRentalAuditForCurrentUser(companyId: string, rentalId: string) {
  const access = await (await import('./access')).getRentalAccess();
  if (!access || (access.scope !== 'SYSTEM' && !access.companyIds.includes(companyId))) return [];
  return prisma.auditLog.findMany({
    where: { companyId, entityType: 'RENTAL', entityId: rentalId },
    select: { id: true, action: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
