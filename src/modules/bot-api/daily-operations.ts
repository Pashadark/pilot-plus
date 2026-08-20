import { prisma } from '@/database/prisma/client';

import { BotApiError } from './auth';
import type { BotIdentityContext } from './queries';

export function moscowDayRange(value?: string) {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const date = value ?? now.toISOString().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (!match) throw new BotApiError('INVALID_REQUEST', 400);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    localCheck.getUTCFullYear() !== year ||
    localCheck.getUTCMonth() !== month - 1 ||
    localCheck.getUTCDate() !== day
  ) {
    throw new BotApiError('INVALID_REQUEST', 400);
  }
  const start = new Date(Date.UTC(year, month - 1, day, -3));
  return { date, start, end: new Date(start.getTime() + 86_400_000) };
}

function person(client: { firstName: string; lastName: string }) {
  return `${client.lastName} ${client.firstName}`.trim();
}
function car(vehicle: {
  make: string | null;
  modelName: string | null;
  model: string;
  registrationNumber: string | null;
}) {
  return {
    make: vehicle.make ?? '',
    model: vehicle.modelName ?? vehicle.model,
    registrationNumber: vehicle.registrationNumber ?? '',
  };
}

export async function listDailyOperations(
  identity: BotIdentityContext,
  date?: string,
  database: typeof prisma = prisma,
) {
  if (identity.kind !== 'STAFF' || !identity.userId) throw new BotApiError('FORBIDDEN', 403);
  const current = await database.telegramIdentity.findFirst({
    where: {
      id: identity.identityId,
      companyId: identity.companyId,
      userId: identity.userId,
      kind: 'STAFF',
      isActive: true,
      user: { is: { isActive: true } },
    },
    select: { user: { select: { role: true } } },
  });
  const member = await database.companyMember.findFirst({
    where: { companyId: identity.companyId, userId: identity.userId },
    select: { role: true },
  });
  if (
    !current ||
    (current.user?.role !== 'SUPER_ADMIN' &&
      !['COMPANY_ADMIN', 'DISPATCHER'].includes(member?.role ?? ''))
  ) {
    throw new BotApiError('FORBIDDEN', 403);
  }
  const range = moscowDayRange(date);
  const overlap = { startsAt: { lt: range.end }, endsAt: { gt: range.start } };
  const [requests, rentals, vehicles] = await Promise.all([
    database.botRentalRequest.findMany({
      where: { companyId: identity.companyId, status: 'PENDING', ...overlap },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        fulfillmentMode: true,
        client: { select: { firstName: true, lastName: true } },
        preferredVehicle: {
          select: { make: true, modelName: true, model: true, registrationNumber: true },
        },
      },
    }),
    database.rental.findMany({
      where: { companyId: identity.companyId, status: { in: ['CONFIRMED', 'ACTIVE'] }, ...overlap },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 200,
      select: {
        id: true,
        contractNumber: true,
        startsAt: true,
        endsAt: true,
        client: { select: { firstName: true, lastName: true } },
        vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
      },
    }),
    database.vehicle.findMany({
      where: { companyId: identity.companyId, archivedAt: null },
      orderBy: [{ make: 'asc' }, { modelName: 'asc' }, { id: 'asc' }],
      take: 300,
      select: {
        id: true,
        make: true,
        modelName: true,
        model: true,
        registrationNumber: true,
        status: true,
        rentals: {
          where: { status: { in: ['CONFIRMED', 'ACTIVE'] }, ...overlap },
          select: { id: true },
          take: 1,
        },
        maintenanceRecords: {
          where: {
            status: { in: ['PLANNED', 'IN_PROGRESS', 'OVERDUE'] },
            scheduledAt: { lt: range.end },
            OR: [{ scheduledEndsAt: { gt: range.start } }, { scheduledEndsAt: null }],
          },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);
  const rentalItems = rentals.map((rental) => ({
    id: rental.id,
    contractNumber: rental.contractNumber,
    startsAt: rental.startsAt.toISOString(),
    endsAt: rental.endsAt.toISOString(),
    clientName: person(rental.client),
    vehicle: car(rental.vehicle),
  }));
  return {
    date: range.date,
    requests: requests.map((request) => ({
      id: request.id,
      startsAt: request.startsAt.toISOString(),
      endsAt: request.endsAt.toISOString(),
      fulfillmentMode: request.fulfillmentMode,
      clientName: person(request.client),
      preferredVehicle: request.preferredVehicle ? car(request.preferredVehicle) : null,
    })),
    rentals: rentalItems,
    returns: rentalItems.filter(
      (rental) => new Date(rental.endsAt) >= range.start && new Date(rental.endsAt) < range.end,
    ),
    freeVehicles: vehicles
      .filter(
        (vehicle) =>
          vehicle.status !== 'MAINTENANCE' &&
          vehicle.rentals.length === 0 &&
          vehicle.maintenanceRecords.length === 0,
      )
      .map((vehicle) => ({ id: vehicle.id, ...car(vehicle) })),
    unavailableVehicles: vehicles
      .filter(
        (vehicle) => vehicle.status === 'MAINTENANCE' || vehicle.maintenanceRecords.length > 0,
      )
      .map((vehicle) => ({ id: vehicle.id, ...car(vehicle) })),
  };
}
