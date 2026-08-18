import 'server-only';

import type { FineStatus, Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import { FineAccessDeniedError, getFineAccess } from '../access';
import { selectFineAttribution } from '../sync/attribute-fine';

const statuses = new Set<FineStatus>(['NEW', 'UNPAID', 'PAID', 'CANCELLED', 'OVERDUE']);
const candidateWindowMs = 72 * 60 * 60 * 1000;

export interface FineListFilters {
  status?: string;
  query?: string;
  companyId?: string;
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
  const companyWhere = selectedCompanyId
    ? { companyId: selectedCompanyId }
    : { companyId: { in: companyIds } };
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
      companyId: true,
      decreeNumber: true,
      offenseAt: true,
      currentAmountMinor: true,
      originalAmountMinor: true,
      status: true,
      description: true,
      address: true,
      photoState: true,
      vehicleId: true,
      rentalId: true,
      clientId: true,
      assignmentSource: true,
      vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
      client: { select: { firstName: true, middleName: true, lastName: true } },
    },
    orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
    take: 200,
  });

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

  const fines = records.map((fine) => {
    const rentals = fine.vehicleId
      ? (rentalsByVehicle.get(`${fine.companyId}:${fine.vehicleId}`) ?? [])
      : [];
    const rentalById = new Map(rentals.map((rental) => [rental.id, rental]));
    const attribution = selectFineAttribution(fine.offenseAt, rentals);
    const assignmentCandidates = attribution.candidates.flatMap((candidate) => {
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
      clientLabel: fine.client ? clientDisplayName(fine.client) : null,
      photoAvailable: fine.photoState === 'AVAILABLE',
      assigned: Boolean(fine.vehicleId && fine.clientId),
      assignedRentalId: fine.rentalId,
      assignmentSource: fine.assignmentSource,
      assignmentCandidates,
    };
  });
  const unpaid = fines.filter(({ status: itemStatus }) =>
    ['NEW', 'UNPAID', 'OVERDUE'].includes(itemStatus),
  );
  return {
    companies,
    selectedCompanyId,
    canSync: Boolean(
      selectedCompanyId &&
      (access.scope === 'SYSTEM' ||
        access.rolesByCompany[selectedCompanyId] === 'COMPANY_ADMIN' ||
        access.rolesByCompany[selectedCompanyId] === 'DISPATCHER'),
    ),
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
