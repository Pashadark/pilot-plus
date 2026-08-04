import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type { ClientAccess } from '@/modules/clients/access';
import type {
  ClientCardDto,
  ClientDetailDto,
  ClientListResult,
  ClientQueryFilters,
} from '@/modules/clients/types';
import { decryptField } from '@/services/security/field-encryption';

type ClientRepository = {
  findMany(args: unknown): Promise<unknown[]>;
  findFirst(args: unknown): Promise<unknown | null>;
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
  phoneEncrypted: string;
  email: string | null;
  passportEncrypted: string | null;
  driverLicenseEncrypted: string | null;
  driverLicenseIssuedAt: Date | null;
  driverLicenseExpiresAt: Date | null;
  status: ClientCardDto['status'];
  createdAt: Date;
  updatedAt: Date;
};

const clientSelect = {
  id: true,
  companyId: true,
  firstName: true,
  middleName: true,
  lastName: true,
  birthDate: true,
  phoneEncrypted: true,
  email: true,
  passportEncrypted: true,
  driverLicenseEncrypted: true,
  driverLicenseIssuedAt: true,
  driverLicenseExpiresAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect;

function tenantWhere(access: ClientAccess): Prisma.ClientWhereInput {
  return access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } };
}

function queryWhere(access: ClientAccess, filters: ClientQueryFilters): Prisma.ClientWhereInput {
  const query = filters.q?.trim();
  return {
    ...tenantWhere(access),
    archivedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
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

function fullName(client: RawClient): string {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
}

function mapCard(client: RawClient, encryptionKey: string): ClientCardDto {
  const phone = decryptField(client.phoneEncrypted, encryptionKey);
  const passport = client.passportEncrypted
    ? decryptField(client.passportEncrypted, encryptionKey)
    : null;
  const driverLicense = client.driverLicenseEncrypted
    ? decryptField(client.driverLicenseEncrypted, encryptionKey)
    : null;

  return {
    id: client.id,
    companyId: client.companyId,
    fullName: fullName(client),
    email: client.email,
    phoneMasked: maskPhone(phone),
    passportMasked: passport ? maskDocument(passport) : null,
    driverLicenseMasked: driverLicense ? maskDocument(driverLicense) : null,
    driverLicenseExpiresAt: client.driverLicenseExpiresAt?.toISOString() ?? null,
    status: client.status,
    updatedAt: client.updatedAt.toISOString(),
  };
}

function mapDetail(client: RawClient, encryptionKey: string): ClientDetailDto {
  return {
    ...mapCard(client, encryptionKey),
    firstName: client.firstName,
    middleName: client.middleName,
    lastName: client.lastName,
    birthDate: client.birthDate?.toISOString() ?? null,
    phone: decryptField(client.phoneEncrypted, encryptionKey),
    passport: client.passportEncrypted
      ? decryptField(client.passportEncrypted, encryptionKey)
      : null,
    driverLicense: client.driverLicenseEncrypted
      ? decryptField(client.driverLicenseEncrypted, encryptionKey)
      : null,
    driverLicenseIssuedAt: client.driverLicenseIssuedAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
  };
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

      return {
        items: (clients as RawClient[]).map((client) =>
          mapCard(client, dependencies.encryptionKey),
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
      return client ? mapDetail(client as RawClient, dependencies.encryptionKey) : null;
    },
  };
}

const queries = createClientQueries(
  {
    findMany: (args) => prisma.client.findMany(args as Prisma.ClientFindManyArgs),
    findFirst: (args) => prisma.client.findFirst(args as Prisma.ClientFindFirstArgs),
  },
  { encryptionKey: process.env.CLIENT_DATA_ENCRYPTION_KEY ?? '' },
);

export const getClients = queries.getClients;
export const getClientById = queries.getClientById;
