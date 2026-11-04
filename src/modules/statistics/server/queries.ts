import 'server-only';
import { prisma } from '@/database/prisma/client';
import { getRentalAccess } from '@/modules/rentals/server/access';
import { getVehiclePromo } from '@/modules/dashboard/vehicle-promo';
import { vehicleName } from '@/shared/lib/vehicle-name';
import { aggregateStatistics, statisticsWindow } from '../domain/aggregate';

const LIMIT = 2000;
export async function getStatisticsWorkspace(filters: { vehicleId?: string; period?: string }) {
  const window = statisticsWindow(filters.period);
  const access = await getRentalAccess();
  if (!access)
    return {
      accessDenied: true as const,
      selected: null,
      vehicles: [],
      window,
      stats: null,
      partial: false,
    };
  const records = await prisma.vehicle.findMany({
    where: {
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
      archivedAt: null,
      isDemoImport: false,
    },
    select: {
      id: true,
      companyId: true,
      make: true,
      model: true,
      registrationNumber: true,
      images: {
        select: { localPath: true, alt: true },
        orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
        take: 1,
      },
    },
    orderBy: [{ make: 'asc' }, { model: 'asc' }, { id: 'asc' }],
    take: 501,
  });
  const vehicles = records.slice(0, 500).map((record) => {
    const name = vehicleName(record.make, record.model);
    const image: { localPath: string; alt: string } | null =
      getVehiclePromo(record.id, name) ?? (record.images.length ? record.images[0] : null);
    return { ...record, name, image };
  });
  const selected = filters.vehicleId
    ? (vehicles.find((vehicle) => vehicle.id === filters.vehicleId) ?? null)
    : (vehicles[0] ?? null);
  if (!selected)
    return {
      accessDenied: false as const,
      selected: null,
      vehicles,
      window,
      stats: null,
      partial: records.length > 500,
    };
  const companyId = selected.companyId;
  const vehicleId = selected.id;
  if (filters.period === 'all') {
    const [firstRental, firstPayment] = await Promise.all([
      prisma.rental.findFirst({
        where: { companyId, vehicleId, status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { startsAt: true },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.rentalPayment.findFirst({
        where: {
          companyId,
          rental: { vehicleId, companyId },
          kind: 'RENT',
          status: { in: ['CONFIRMED', 'PARTIALLY_REFUNDED'] },
        },
        select: { recordedAt: true },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const earliest = Math.min(
      firstRental?.startsAt.getTime() ?? Infinity,
      firstPayment?.recordedAt.getTime() ?? Infinity,
      window.to.getTime() - 86_400_000,
    );
    window.from = new Date(
      Math.floor((earliest + 10_800_000) / 86_400_000) * 86_400_000 - 10_800_000,
    );
    window.days = Math.max(
      1,
      Math.round((window.to.getTime() - window.from.getTime()) / 86_400_000),
    );
  }
  const dates = { gte: window.from, lt: window.to };
  const scopedVehicle = { vehicleId, vehicle: { companyId } };
  const [payments, rentals, maintenance, washes, visits] = await Promise.all([
    prisma.rentalPayment.findMany({
      where: {
        companyId,
        rental: { vehicleId, companyId },
        recordedAt: dates,
        kind: 'RENT',
        status: { in: ['CONFIRMED', 'PARTIALLY_REFUNDED'] },
      },
      select: { kind: true, status: true, amountMinor: true, currency: true, recordedAt: true },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      take: LIMIT + 1,
    }),
    prisma.rental.findMany({
      where: {
        companyId,
        vehicleId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        OR: [
          {
            AND: [
              {
                OR: [
                  { activatedAt: { lt: window.to } },
                  { activatedAt: null, startsAt: { lt: window.to } },
                ],
              },
              {
                OR: [
                  { completedAt: { gt: window.from } },
                  { completedAt: null, endsAt: { gt: window.from } },
                ],
              },
            ],
          },
          { operations: { some: { type: 'RETURN', status: 'COMMITTED', occurredAt: dates } } },
        ],
      },
      select: {
        status: true,
        startsAt: true,
        endsAt: true,
        activatedAt: true,
        completedAt: true,
        operations: {
          where: { status: 'COMMITTED', type: { in: ['HANDOVER', 'RETURN'] } },
          select: { type: true, occurredAt: true, mileageKm: true },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          take: 11,
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: LIMIT + 1,
    }),
    prisma.maintenanceRecord.findMany({
      where: { ...scopedVehicle, status: 'COMPLETED', completedAt: dates },
      select: { costMinor: true, completedAt: true },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
      take: LIMIT + 1,
    }),
    prisma.washRecord.findMany({
      where: { ...scopedVehicle, status: 'COMPLETED', completedAt: dates },
      select: { costMinor: true, completedAt: true },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
      take: LIMIT + 1,
    }),
    prisma.fuelStationVisit.findMany({
      where: { ...scopedVehicle, enteredAt: dates },
      select: {
        id: true,
        enteredAt: true,
        station: { select: { name: true, brand: true, latitude: true, longitude: true } },
      },
      orderBy: [{ enteredAt: 'asc' }, { id: 'asc' }],
      take: LIMIT + 1,
    }),
  ]);
  const partial =
    records.length > 500 ||
    [payments, rentals, maintenance, washes, visits].some((rows) => rows.length > LIMIT) ||
    rentals.some((rental) => rental.operations.length > 10);
  const stats = aggregateStatistics({
    from: window.from,
    to: window.to,
    payments: payments.slice(0, LIMIT),
    rentals: rentals
      .slice(0, LIMIT)
      .map((rental) => ({ ...rental, operations: rental.operations.slice(0, 10) })),
    costs: [...maintenance.slice(0, LIMIT), ...washes.slice(0, LIMIT)].flatMap((record) =>
      record.costMinor !== null && record.completedAt
        ? [{ costMinor: BigInt(record.costMinor), completedAt: record.completedAt }]
        : [],
    ),
    visits: visits.slice(0, LIMIT).map((visit) => ({
      id: visit.id,
      enteredAt: visit.enteredAt,
      latitude: Number(visit.station.latitude),
      longitude: Number(visit.station.longitude),
      name: visit.station.name ?? visit.station.brand ?? 'АЗС без названия',
    })),
  });
  return {
    accessDenied: false as const,
    selected,
    vehicles,
    window,
    stats,
    partial,
    unknownCosts: [...maintenance, ...washes].filter((record) => record.costMinor === null).length,
    allTime: filters.period === 'all',
  };
}
export type StatisticsWorkspace = Awaited<ReturnType<typeof getStatisticsWorkspace>>;
