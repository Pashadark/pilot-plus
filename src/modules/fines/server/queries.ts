import { vehicleName } from '@/shared/lib/vehicle-name';
import 'server-only';

import type { FineStatus, Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import { FineAccessDeniedError, getFineAccess } from '../access';
import { selectFineAttribution } from '../sync/attribute-fine';
import { loadTollDebts } from './toll-queries';
import type { FineItem } from '../components/FinesPage';

const statuses = new Set<FineStatus>(['NEW', 'UNPAID', 'PAID', 'CANCELLED', 'OVERDUE']);
const candidateWindowMs = 72 * 60 * 60 * 1000;

export interface FineListFilters {
  status?: string;
  query?: string;
  companyId?: string;
  offenseFrom?: string;
  offenseTo?: string;
  vehicleId?: string;
  clientId?: string;
  page?: string;
}

const pageSize = 24;

function parseDay(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function clientDisplayName(client: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
}

function distanceLabel(distanceMs: number, relativeToOffense: 'BEFORE' | 'DURING' | 'AFTER') {
  if (relativeToOffense === 'DURING') return 'Во время нарушения';
  const totalMinutes = Math.round(distanceMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration =
    hours === 0 ? `${minutes} мин` : minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`;
  return `${duration} ${relativeToOffense === 'BEFORE' ? 'до' : 'после'}`;
}

export async function listFinesForCurrentUser(filters: FineListFilters) {
  const access = await getFineAccess();
  if (!access) throw new FineAccessDeniedError();

  const status =
    filters.status && statuses.has(filters.status as FineStatus)
      ? (filters.status as FineStatus)
      : undefined;
  const query = filters.query?.trim();
  const companies = await prisma.company.findMany({
    where: access.scope === 'SYSTEM' ? {} : { id: { in: [...access.companyIds] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const requestedCompanyId = companies.some(({ id }) => id === filters.companyId)
    ? filters.companyId
    : undefined;
  const selectedCompanyId =
    requestedCompanyId ?? (companies.length === 1 ? companies[0]?.id : undefined);
  const companyIds = companies.map(({ id }) => id);
  const scopedCompanyIds = selectedCompanyId ? [selectedCompanyId] : companyIds;
  const [vehicles, clients] = await Promise.all([
    prisma.vehicle.findMany({
      where: { companyId: { in: scopedCompanyIds }, archivedAt: null },
      select: { id: true, make: true, modelName: true, model: true, registrationNumber: true },
      orderBy: [{ registrationNumber: 'asc' }, { id: 'asc' }],
    }),
    prisma.client.findMany({
      where: { companyId: { in: scopedCompanyIds }, archivedAt: null },
      select: { id: true, firstName: true, middleName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const vehicleId = vehicles.some(({ id }) => id === filters.vehicleId)
    ? filters.vehicleId
    : undefined;
  const clientId = clients.some(({ id }) => id === filters.clientId) ? filters.clientId : undefined;
  const offenseFrom = parseDay(filters.offenseFrom);
  const offenseTo = parseDay(filters.offenseTo, true);
  const parsedPage = Number.parseInt(filters.page ?? '1', 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const companyWhere = selectedCompanyId
    ? { companyId: selectedCompanyId }
    : { companyId: { in: companyIds } };
  const where: Prisma.FineWhereInput = {
    ...companyWhere,
    ...(status ? { status } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(offenseFrom || offenseTo
      ? {
          offenseAt: {
            ...(offenseFrom ? { gte: offenseFrom } : {}),
            ...(offenseTo ? { lte: offenseTo } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { decreeNumber: { contains: query, mode: 'insensitive' } },
            { vehicle: { registrationNumberNormalized: { contains: query } } },
            { client: { lastName: { contains: query, mode: 'insensitive' } } },
            { rental: { contractNumber: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const now = new Date();
  const tollResult = await loadTollDebts(scopedCompanyIds);
  const tolls = tollResult.items.filter(
    (item) =>
      (!status || status === 'UNPAID') &&
      (!vehicleId || item.vehicleId === vehicleId) &&
      (!clientId || item.clientId === clientId) &&
      (!offenseFrom || new Date(item.offenseAt) >= offenseFrom) &&
      (!offenseTo || new Date(item.offenseAt) <= offenseTo) &&
      (!query ||
        [item.vehicleLabel, item.clientLabel, item.rentalLabel, item.roadLabel, item.description]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('ru')
          .includes(query.toLocaleLowerCase('ru'))),
  );
  const discountSoon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const withinFilteredScope = (constraint: Prisma.FineWhereInput): Prisma.FineWhereInput => ({
    AND: [where, constraint],
  });
  // Select the page after prioritising active discounts, not after pagination.
  const priorities = await prisma.fine.findMany({
    where,
    select: {
      id: true,
      status: true,
      discountExpiresAt: true,
      currentAmountMinor: true,
      originalAmountMinor: true,
      offenseAt: true,
    },
    orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
  });
  const deadline = (fine: (typeof priorities)[number]) =>
    fine.status !== 'PAID' &&
    fine.status !== 'CANCELLED' &&
    fine.discountExpiresAt &&
    fine.discountExpiresAt >= now &&
    fine.currentAmountMinor < fine.originalAmountMinor
      ? fine.discountExpiresAt.getTime()
      : Infinity;
  const allPriorities = [
    ...priorities,
    ...tolls.map((t) => ({
      id: t.id,
      status: t.status,
      discountExpiresAt: null,
      currentAmountMinor: BigInt(t.currentAmountMinor),
      originalAmountMinor: BigInt(t.originalAmountMinor),
      offenseAt: new Date(t.offenseAt),
    })),
  ];
  allPriorities.sort(
    (a, b) =>
      deadline(a) - deadline(b) ||
      b.offenseAt.getTime() - a.offenseAt.getTime() ||
      b.id.localeCompare(a.id),
  );
  const allPageIds = allPriorities
    .slice((page - 1) * pageSize, page * pageSize)
    .map((fine) => fine.id);
  const pageIds = allPageIds.filter((id) => !id.startsWith('toll:'));

  const [
    records,
    total,
    newCount,
    unpaidMetrics,
    unassignedCount,
    discountEndingSoonCount,
    bailiffRiskCount,
  ] = await Promise.all([
    prisma.fine.findMany({
      where: { AND: [where, { id: { in: pageIds } }] },
      select: {
        id: true,
        companyId: true,
        decreeNumber: true,
        decreeAt: true,
        assignmentConfirmedAt: true,
        offenseAt: true,
        currentAmountMinor: true,
        originalAmountMinor: true,
        status: true,
        description: true,
        address: true,
        comment: true,
        discountExpiresAt: true,
        toBailiff: true,
        photoState: true,
        vehicleId: true,
        rentalId: true,
        clientId: true,
        assignmentSource: true,
        rental: { select: { contractNumber: true } },
        vehicle: {
          select: { make: true, modelName: true, model: true, registrationNumber: true },
        },
        client: { select: { firstName: true, middleName: true, lastName: true } },
      },
      orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
      take: pageSize,
    }),
    prisma.fine.count({ where }),
    prisma.fine.count({ where: withinFilteredScope({ status: 'NEW' }) }),
    prisma.fine.aggregate({
      where: withinFilteredScope({ status: { in: ['NEW', 'UNPAID', 'OVERDUE'] } }),
      _count: { _all: true },
      _sum: { currentAmountMinor: true },
    }),
    prisma.fine.count({
      where: withinFilteredScope({ OR: [{ vehicleId: null }, { clientId: null }] }),
    }),
    prisma.fine.count({
      where: withinFilteredScope({ discountExpiresAt: { gte: now, lte: discountSoon } }),
    }),
    prisma.fine.count({ where: withinFilteredScope({ toBailiff: true }) }),
  ]);

  const attributableFines = records.filter((fine): fine is typeof fine & { vehicleId: string } =>
    Boolean(fine.vehicleId),
  );
  const candidateRentals =
    attributableFines.length > 0
      ? await prisma.rental.findMany({
          where: {
            companyId: { in: companyIds },
            OR: attributableFines.map(({ companyId, vehicleId, offenseAt }) => ({
              companyId,
              vehicleId,
              startsAt: { lte: new Date(offenseAt.getTime() + candidateWindowMs) },
              endsAt: { gte: new Date(offenseAt.getTime() - candidateWindowMs) },
            })),
          },
          select: {
            id: true,
            companyId: true,
            vehicleId: true,
            clientId: true,
            contractNumber: true,
            startsAt: true,
            endsAt: true,
            client: { select: { firstName: true, middleName: true, lastName: true } },
          },
        })
      : [];
  const rentalsByVehicle = new Map<string, typeof candidateRentals>();
  for (const rental of candidateRentals) {
    const key = `${rental.companyId}:${rental.vehicleId}`;
    rentalsByVehicle.set(key, [...(rentalsByVehicle.get(key) ?? []), rental]);
  }

  const fines: FineItem[] = records.map((fine) => {
    const rentals = fine.vehicleId
      ? (rentalsByVehicle.get(`${fine.companyId}:${fine.vehicleId}`) ?? [])
      : [];
    const rentalById = new Map(rentals.map((rental) => [rental.id, rental]));
    const attribution = selectFineAttribution(fine.offenseAt, rentals);
    const assignmentCandidates = fine.clientId
      ? []
      : attribution.candidates.flatMap((candidate) => {
          const rental = rentalById.get(candidate.id);
          return rental
            ? [
                {
                  rentalId: rental.id,
                  contractNumber: rental.contractNumber,
                  clientDisplayName: clientDisplayName(rental.client),
                  startsAt: rental.startsAt.toISOString(),
                  endsAt: rental.endsAt.toISOString(),
                  distanceMs: candidate.distanceMs,
                  distanceLabel: distanceLabel(candidate.distanceMs, candidate.relativeToOffense),
                  relativeToOffense: candidate.relativeToOffense,
                },
              ]
            : [];
        });
    return {
      id: fine.id,
      companyId: fine.companyId,
      decreeNumber: fine.decreeNumber,
      decreeAt: fine.decreeAt?.toISOString() ?? null,
      assignmentConfirmedAt: fine.assignmentConfirmedAt?.toISOString() ?? null,
      rentalId: fine.rentalId,
      offenseAt: fine.offenseAt.toISOString(),
      currentAmountMinor: fine.currentAmountMinor.toString(),
      originalAmountMinor: fine.originalAmountMinor.toString(),
      status: fine.status,
      description: fine.description,
      address: fine.address,
      comment: fine.comment,
      discountExpiresAt: fine.discountExpiresAt?.toISOString() ?? null,
      toBailiff: fine.toBailiff,
      vehicleLabel: fine.vehicle
        ? [
            vehicleName(fine.vehicle.make, fine.vehicle.modelName ?? fine.vehicle.model),
            fine.vehicle.registrationNumber,
          ]
            .filter(Boolean)
            .join(' · ')
        : '',
      clientLabel: fine.client ? clientDisplayName(fine.client) : null,
      rentalLabel: fine.rental?.contractNumber ?? null,
      photoAvailable: fine.photoState === 'AVAILABLE',
      assigned: Boolean(fine.vehicleId && fine.clientId),
      assignedRentalId: fine.rentalId,
      assignmentSource: fine.assignmentSource,
      assignmentCandidates,
    };
  });
  fines.push(...tolls.filter((t) => allPageIds.includes(t.id)));
  fines.sort((a, b) => allPageIds.indexOf(a.id) - allPageIds.indexOf(b.id));
  const selectedRole = selectedCompanyId ? access.rolesByCompany[selectedCompanyId] : undefined;
  const canManage = Boolean(
    selectedCompanyId &&
    (access.scope === 'SYSTEM' ||
      selectedRole === 'COMPANY_ADMIN' ||
      selectedRole === 'DISPATCHER'),
  );
  return {
    companies,
    selectedCompanyId,
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label:
        [vehicleName(vehicle.make, vehicle.modelName ?? vehicle.model), vehicle.registrationNumber]
          .filter(Boolean)
          .join(' · ') || vehicle.id,
    })),
    clients: clients.map((client) => ({ id: client.id, label: clientDisplayName(client) })),
    filters: {
      status,
      query,
      companyId: selectedCompanyId,
      offenseFrom: filters.offenseFrom,
      offenseTo: filters.offenseTo,
      vehicleId,
      clientId,
    },
    pagination: {
      page,
      pageSize,
      total: total + tolls.length,
      totalPages: Math.max(1, Math.ceil((total + tolls.length) / pageSize)),
    },
    tollsUnavailable: tollResult.unavailable,
    canSync: canManage,
    canManage,
    canPay: Boolean(
      selectedCompanyId &&
      (access.user?.role === 'SUPER_ADMIN' || selectedRole === 'COMPANY_ADMIN'),
    ),
    fines,
    summary: {
      newCount,
      unpaidCount: unpaidMetrics._count._all + tolls.length,
      unpaidAmountMinor: (
        BigInt(unpaidMetrics._sum.currentAmountMinor ?? 0) +
        tolls.reduce((sum, t) => sum + BigInt(t.currentAmountMinor), BigInt(0))
      ).toString(),
      unassignedCount: unassignedCount + tolls.filter((t) => !t.assigned).length,
      discountEndingSoonCount,
      bailiffRiskCount,
    },
  };
}
