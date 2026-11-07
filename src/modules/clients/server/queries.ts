import { vehicleName } from '@/shared/lib/vehicle-name';
import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type { ClientAccess } from '@/modules/clients/access';
import { clientPhotoRevision } from '@/modules/clients/photo-revision';
import type {
  ClientCardDto,
  ClientDetailDto,
  ClientListResult,
  ClientQueryFilters,
} from '@/modules/clients/types';
import { decryptField } from '@/services/security/field-encryption';
import { parsePassportDetails } from '@/modules/clients/passport-details';

type ClientRepository = {
  findMany(args: unknown): Promise<unknown[]>;
  findFirst(args: unknown): Promise<unknown | null>;
  fineFindMany(args: unknown): Promise<unknown[]>;
};

type QueryDependencies = {
  encryptionKey: string;
};

type RawClient = {
  id: string;
  companyId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: Date | null;
  phoneEncrypted: string | null;
  additionalPhoneEncrypted: string | null;
  email: string | null;
  passportEncrypted: string | null;
  registrationAddressEncrypted?: string | null;
  actualAddressEncrypted?: string | null;
  driverLicenseEncrypted: string | null;
  driverLicenseIssuedAt: Date | null;
  driverLicenseExpiresAt: Date | null;
  status: ClientCardDto['status'];
  createdAt: Date;
  updatedAt: Date;
  photoPath: string | null;
  telegramUsername: string | null;
  rentals: Array<{
    id: string;
    contractNumber: string | null;
    status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    startsAt: Date;
    endsAt: Date;
    totalPriceMinor: bigint;
    depositMinor: bigint | null;
    vehicle: { make: string; model: string; registrationNumber: string | null };
    operations: Array<{
      depositStatus:
        'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | null;
      occurredAt: Date;
    }>;
    payments?: Array<{ amountMinor: bigint }>;
  }>;
  _count: { rentals: number };
};

type RawFine = {
  clientId: string | null;
  status: 'NEW' | 'UNPAID' | 'PAID' | 'CANCELLED' | 'OVERDUE' | 'ARCHIVED';
  currentAmountMinor: bigint;
};

type FineSummary = { total: number; paidAmountMinor: bigint };

const clientSelect = {
  id: true,
  companyId: true,
  firstName: true,
  middleName: true,
  lastName: true,
  birthDate: true,
  phoneEncrypted: true,
  additionalPhoneEncrypted: true,
  email: true,
  passportEncrypted: true,
  registrationAddressEncrypted: true,
  actualAddressEncrypted: true,
  driverLicenseEncrypted: true,
  driverLicenseIssuedAt: true,
  driverLicenseExpiresAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  photoPath: true,
  telegramUsername: true,
  rentals: {
    select: {
      id: true,
      contractNumber: true,
      status: true,
      startsAt: true,
      endsAt: true,
      totalPriceMinor: true,
      depositMinor: true,
      vehicle: { select: { make: true, model: true, registrationNumber: true } },
      operations: {
        where: { status: 'COMMITTED', depositStatus: { not: null } },
        select: { depositStatus: true, occurredAt: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
      payments: {
        where: { kind: 'DEPOSIT', status: 'CONFIRMED' },
        select: { amountMinor: true },
      },
    },
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    take: 25,
  },
  _count: { select: { rentals: true } },
} satisfies Prisma.ClientSelect;

function tenantWhere(access: ClientAccess): Prisma.ClientWhereInput {
  return access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } };
}

function queryWhere(access: ClientAccess, filters: ClientQueryFilters): Prisma.ClientWhereInput {
  const query = filters.q?.trim();
  const now = new Date();
  return {
    ...tenantWhere(access),
    archivedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.documents === 'present' ? { passportEncrypted: { not: null } } : {}),
    ...(filters.documents === 'missing' ? { passportEncrypted: null } : {}),
    ...(filters.license === 'present' ? { driverLicenseEncrypted: { not: null } } : {}),
    ...(filters.license === 'missing' ? { driverLicenseEncrypted: null } : {}),
    ...(filters.renting === 'active'
      ? {
          rentals: {
            some: {
              status: { in: ['CONFIRMED', 'ACTIVE'] },
              startsAt: { lte: now },
              endsAt: { gte: now },
            },
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { middleName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

function maskDocument(value: string): string {
  const digits = value.replace(/\D/g, '');
  let seen = 0;
  return [...value]
    .map((character) => {
      if (!/\d/.test(character)) return character;
      seen += 1;
      return seen <= 2 || seen > digits.length - 3 ? character : '•';
    })
    .join('');
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ••• •••-${digits.slice(-4, -2)}-${digits.slice(-2)}`;
  }
  return '••••••••';
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const normalized =
    digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
  if (normalized.length === 11 && normalized.startsWith('7')) {
    return `+7 ${normalized.slice(1, 4)} ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9)}`;
  }
  return value;
}

function fullName(client: RawClient): string {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
}

function vehicleLabel(make: string, model: string): string {
  return vehicleName(make, model);
}

function mapCard(
  client: RawClient,
  encryptionKey: string,
  fineSummary: FineSummary = { total: 0, paidAmountMinor: BigInt(0) },
): ClientCardDto {
  const phone = client.phoneEncrypted ? decryptField(client.phoneEncrypted, encryptionKey) : null;
  const additionalPhone = client.additionalPhoneEncrypted
    ? decryptField(client.additionalPhoneEncrypted, encryptionKey)
    : null;
  const passport = client.passportEncrypted
    ? decryptField(client.passportEncrypted, encryptionKey)
    : null;
  const driverLicense = client.driverLicenseEncrypted
    ? decryptField(client.driverLicenseEncrypted, encryptionKey)
    : null;
  const rentals = client.rentals.map((rental) => {
    const operationStatus = rental.operations[0]?.depositStatus ?? null;
    const paidDepositMinor = (rental.payments ?? []).reduce(
      (total, payment) => total + payment.amountMinor,
      BigInt(0),
    );
    const depositStatus =
      operationStatus ??
      (rental.depositMinor && paidDepositMinor >= rental.depositMinor ? 'COLLECTED' : null);
    return {
      id: rental.id,
      contractNumber: rental.contractNumber,
      status: rental.status,
      startsAt: rental.startsAt.toISOString(),
      endsAt: rental.endsAt.toISOString(),
      totalPriceMinor: rental.totalPriceMinor.toString(),
      depositMinor: rental.depositMinor?.toString() ?? null,
      depositStatus,
      depositReturnedAt:
        operationStatus === 'RETURNED'
          ? rental.operations[0]?.occurredAt.toISOString() ?? null
          : null,
      vehicle: {
        label: vehicleLabel(rental.vehicle.make, rental.vehicle.model),
        registrationNumber: rental.vehicle.registrationNumber,
      },
    };
  });
  const now = Date.now();
  const currentRentals = rentals.filter(
    (rental) =>
      (rental.status === 'ACTIVE' || rental.status === 'CONFIRMED') &&
      new Date(rental.startsAt).getTime() <= now &&
      new Date(rental.endsAt).getTime() >= now,
  );

  return {
    id: client.id,
    companyId: client.companyId,
    fullName: fullName(client),
    email: client.email,
    phone: phone ? formatPhone(phone) : null,
    additionalPhone: additionalPhone ? formatPhone(additionalPhone) : null,
    phoneMasked: phone ? maskPhone(phone) : 'Нет телефона',
    passportMasked: passport ? maskDocument(passport) : null,
    driverLicenseMasked: driverLicense ? maskDocument(driverLicense) : null,
    driverLicenseExpiresAt: client.driverLicenseExpiresAt?.toISOString() ?? null,
    status: client.status,
    updatedAt: client.updatedAt.toISOString(),
    localPhotoUrl: client.photoPath
      ? `/clients/${client.id}/photo?v=${clientPhotoRevision(client.updatedAt)}`
      : null,
    telegramUrl:
      client.telegramUsername && /^[a-zA-Z0-9_]{5,32}$/.test(client.telegramUsername)
        ? `https://t.me/${client.telegramUsername}`
        : null,
    fineSummary: {
      total: fineSummary.total,
      paidAmountMinor: fineSummary.paidAmountMinor.toString(),
    },
    rentalSummary: {
      total: client._count.rentals,
      active: currentRentals.length,
      current: currentRentals[0] ?? null,
      last: rentals[0] ?? null,
    },
  };
}

function mapDetail(
  client: RawClient,
  encryptionKey: string,
  fineSummary?: FineSummary,
): ClientDetailDto {
  const passport = client.passportEncrypted
    ? decryptField(client.passportEncrypted, encryptionKey)
    : null;
  return {
    ...mapCard(client, encryptionKey, fineSummary),
    firstName: client.firstName,
    middleName: client.middleName,
    lastName: client.lastName,
    birthDate: client.birthDate?.toISOString() ?? null,
    phone: client.phoneEncrypted ? decryptField(client.phoneEncrypted, encryptionKey) : null,
    additionalPhone: client.additionalPhoneEncrypted
      ? decryptField(client.additionalPhoneEncrypted, encryptionKey)
      : null,
    passport,
    ...parsePassportDetails(passport),
    registrationAddress: client.registrationAddressEncrypted
      ? decryptField(client.registrationAddressEncrypted, encryptionKey)
      : null,
    actualAddress: client.actualAddressEncrypted
      ? decryptField(client.actualAddressEncrypted, encryptionKey)
      : null,
    driverLicense: client.driverLicenseEncrypted
      ? decryptField(client.driverLicenseEncrypted, encryptionKey)
      : null,
    driverLicenseIssuedAt: client.driverLicenseIssuedAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
  };
}

async function loadFineSummaries(repository: ClientRepository, clients: readonly RawClient[]) {
  if (clients.length === 0) return new Map<string, FineSummary>();

  const companyIds = [...new Set(clients.map((client) => client.companyId))];
  const clientIds = clients.map((client) => client.id);
  const fines = (await repository.fineFindMany({
    where: {
      companyId: { in: companyIds },
      clientId: { in: clientIds },
      status: { not: 'CANCELLED' },
    },
    select: { clientId: true, status: true, currentAmountMinor: true },
    orderBy: [{ clientId: 'asc' }, { id: 'asc' }],
  })) as RawFine[];

  const summaries = new Map<string, FineSummary>();
  for (const fine of fines) {
    if (!fine.clientId || !clientIds.includes(fine.clientId)) continue;
    const current = summaries.get(fine.clientId) ?? { total: 0, paidAmountMinor: BigInt(0) };
    summaries.set(fine.clientId, {
      total: current.total + 1,
      paidAmountMinor:
        current.paidAmountMinor + (fine.status === 'PAID' ? fine.currentAmountMinor : BigInt(0)),
    });
  }
  return summaries;
}

function normalizedPagination(filters: ClientQueryFilters): { page: number; pageSize: number } {
  const page =
    Number.isInteger(filters.page) && filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize =
    Number.isInteger(filters.pageSize) && filters.pageSize && filters.pageSize > 0
      ? Math.min(filters.pageSize, 100)
      : 24;
  return { page, pageSize };
}

export function createClientQueries(repository: ClientRepository, dependencies: QueryDependencies) {
  return {
    async getClients(
      access: ClientAccess,
      filters: ClientQueryFilters = {},
    ): Promise<ClientListResult> {
      const { page, pageSize } = normalizedPagination(filters);
      const clients = await repository.findMany({
        where: queryWhere(access, filters),
        select: clientSelect,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const rawClients = clients as RawClient[];
      const fineSummaries = await loadFineSummaries(repository, rawClients);

      return {
        items: rawClients.map((client) =>
          mapCard(client, dependencies.encryptionKey, fineSummaries.get(client.id)),
        ),
        page,
        pageSize,
      };
    },
    async getClientById(access: ClientAccess, id: string): Promise<ClientDetailDto | null> {
      const client = await repository.findFirst({
        where: { id, ...tenantWhere(access), archivedAt: null },
        select: clientSelect,
      });
      if (!client) return null;
      const rawClient = client as RawClient;
      const fineSummaries = await loadFineSummaries(repository, [rawClient]);
      return mapDetail(rawClient, dependencies.encryptionKey, fineSummaries.get(rawClient.id));
    },
  };
}

const queries = createClientQueries(
  {
    findMany: (args) => prisma.client.findMany(args as Prisma.ClientFindManyArgs),
    findFirst: (args) => prisma.client.findFirst(args as Prisma.ClientFindFirstArgs),
    fineFindMany: (args) => prisma.fine.findMany(args as Prisma.FineFindManyArgs),
  },
  { encryptionKey: process.env.CLIENT_DATA_ENCRYPTION_KEY ?? '' },
);

export const getClients = queries.getClients;
export const getClientById = queries.getClientById;

export async function getClientCompanyOptions(access: ClientAccess) {
  return prisma.company.findMany({
    where: access.scope === 'SYSTEM' ? {} : { id: { in: [...access.companyIds] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
