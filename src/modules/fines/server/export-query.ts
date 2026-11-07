import 'server-only';

import type { FineStatus, Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { vehicleName } from '@/shared/lib/vehicle-name';

import { FineAccessDeniedError, getFineAccess } from '../access';
import type { FineListFilters } from './queries';
import type { FineExportRow } from './fine-export';
import { buildFineSearchWhere, matchesTollSearch } from './search';
import { loadTollDebts } from './toll-queries';
import { deadlineDay } from '../deadline-queue';

const statuses = new Set<FineStatus>([
  'NEW',
  'UNPAID',
  'PAID',
  'CANCELLED',
  'OVERDUE',
  'ARCHIVED',
]);

function parseDay(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function clientName(client: { firstName: string; middleName: string | null; lastName: string }) {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
}

export async function listFineExportRowsForCurrentUser(
  filters: FineListFilters,
): Promise<FineExportRow[]> {
  const access = await getFineAccess();
  if (!access) throw new FineAccessDeniedError();

  const companies = await prisma.company.findMany({
    where: access.scope === 'SYSTEM' ? {} : { id: { in: [...access.companyIds] } },
    select: { id: true },
  });
  const requestedCompanyId = companies.some(({ id }) => id === filters.companyId)
    ? filters.companyId
    : undefined;
  const selectedCompanyId =
    requestedCompanyId ?? (companies.length === 1 ? companies[0]?.id : undefined);
  const scopedCompanyIds = selectedCompanyId
    ? [selectedCompanyId]
    : companies.map(({ id }) => id);

  const [vehicleExists, clientExists] = await Promise.all([
    filters.vehicleId
      ? prisma.vehicle.findFirst({
          where: { id: filters.vehicleId, companyId: { in: scopedCompanyIds } },
          select: { id: true },
        })
      : null,
    filters.clientId
      ? prisma.client.findFirst({
          where: { id: filters.clientId, companyId: { in: scopedCompanyIds } },
          select: { id: true },
        })
      : null,
  ]);
  const vehicleId = vehicleExists?.id;
  const clientId = clientExists?.id;
  const status =
    filters.status && statuses.has(filters.status as FineStatus)
      ? (filters.status as FineStatus)
      : undefined;
  const query = filters.query?.trim();
  const offenseFrom = parseDay(filters.offenseFrom);
  const offenseTo = parseDay(filters.offenseTo, true);
  const where: Prisma.FineWhereInput = {
    companyId: { in: scopedCompanyIds },
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
    ...(buildFineSearchWhere(query) ?? {}),
  };

  const [records, tollResult] = await Promise.all([
    prisma.fine.findMany({
      where,
      select: {
        offenseAt: true,
        provider: true,
        decreeNumber: true,
        uin: true,
        description: true,
        address: true,
        currentAmountMinor: true,
        originalAmountMinor: true,
        status: true,
        discountExpiresAt: true,
        toBailiff: true,
        vehicleId: true,
        clientId: true,
        rentalId: true,
        vehicle: {
          select: { make: true, modelName: true, model: true, registrationNumber: true },
        },
        client: { select: { firstName: true, middleName: true, lastName: true } },
        rental: { select: { contractNumber: true } },
      },
      orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
    }),
    loadTollDebts(scopedCompanyIds),
  ]);

  const fines: FineExportRow[] = records.map((fine) => ({
    offenseAt: fine.offenseAt.toISOString(),
    kind: 'FINE',
    source: fine.provider,
    decreeNumber: fine.decreeNumber || fine.uin || '',
    description: fine.description,
    address: fine.address,
    currentAmountMinor: fine.currentAmountMinor.toString(),
    originalAmountMinor: fine.originalAmountMinor.toString(),
    status: fine.status,
    vehicleLabel: fine.vehicle
      ? [
          vehicleName(fine.vehicle.make, fine.vehicle.modelName ?? fine.vehicle.model),
          fine.vehicle.registrationNumber,
        ]
          .filter(Boolean)
          .join(' · ')
      : '',
    clientLabel: fine.client ? clientName(fine.client) : null,
    rentalLabel: fine.rental?.contractNumber ?? null,
    assigned: Boolean(fine.vehicleId && fine.clientId && fine.rentalId),
    discountExpiresAt: fine.discountExpiresAt?.toISOString() ?? null,
    toBailiff: fine.toBailiff,
  }));
  const tolls: FineExportRow[] = tollResult.items
    .filter(
      (item) =>
        (!status || status === 'UNPAID') &&
        (!vehicleId || item.vehicleId === vehicleId) &&
        (!clientId || item.clientId === clientId) &&
        (!offenseFrom || new Date(item.offenseAt) >= offenseFrom) &&
        (!offenseTo || new Date(item.offenseAt) <= offenseTo) &&
        matchesTollSearch(item, query),
    )
    .map((item) => ({
      offenseAt: item.offenseAt,
      kind: 'TOLL',
      source: item.roadLabel,
      decreeNumber: item.decreeNumber,
      description: item.description,
      address: item.address,
      currentAmountMinor: item.currentAmountMinor,
      originalAmountMinor: item.originalAmountMinor,
      status: item.status,
      vehicleLabel: item.vehicleLabel,
      clientLabel: item.clientLabel,
      rentalLabel: item.rentalLabel,
      assigned: item.assigned,
      discountExpiresAt: null,
      toBailiff: false,
    }));

  const selectedDay = parseDay(filters.discountDay) ? filters.discountDay : undefined;
  return [...fines, ...tolls].filter(fine => !selectedDay || (
    fine.status !== 'PAID' && fine.status !== 'CANCELLED' && fine.status !== 'ARCHIVED' && fine.discountExpiresAt &&
    Date.parse(fine.discountExpiresAt) >= Date.now() &&
    BigInt(fine.currentAmountMinor) < BigInt(fine.originalAmountMinor) &&
    deadlineDay(fine.discountExpiresAt) === selectedDay
  )).sort(
    (left, right) => Date.parse(right.offenseAt) - Date.parse(left.offenseAt),
  );
}
