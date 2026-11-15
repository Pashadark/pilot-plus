import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { ClientDocumentListItem } from '@/modules/client-documents/types';
import type { ClientAccess } from '@/modules/clients/access';
import { getClientById, getClientCompanyOptions, getClients } from '@/modules/clients/server/queries';
import { listRentalDraftVehicleOptions } from '@/modules/rentals/server/draft-vehicle-options';

export type RentalConstructorClientOption = {
  id: string;
  companyId: string;
  fullName: string;
  phone: string | null;
  status: string;
};

export type RentalConstructorCompanyOption = { id: string; name: string };
export type RentalConstructorCompany = RentalConstructorCompanyOption & {
  contractCity: string | null;
};
export type RentalConstructorVehicleOption = Awaited<
  ReturnType<typeof listRentalDraftVehicleOptions>
>[number];

type PreferredOptions = {
  preferredCompanyId?: string;
  preferredClientId?: string;
};

type BootstrapDependencies = {
  listCompanies(access: ClientAccess): Promise<RentalConstructorCompanyOption[]>;
  listClients(access: ClientAccess, companyId: string): Promise<RentalConstructorClientOption[]>;
  getClient(
    access: ClientAccess,
    clientId: string,
  ): Promise<RentalConstructorClientOption | null>;
  listVehicles(companyId: string): Promise<RentalConstructorVehicleOption[]>;
  getTemplate(companyId: string): Promise<{ id: string } | null>;
  getCompany(companyId: string): Promise<RentalConstructorCompany | null>;
  listDocuments(
    companyId: string,
    clientIds: readonly string[],
  ): Promise<Array<ClientDocumentListItem & { clientId: string }>>;
};

function scopedAccess(access: ClientAccess, companyId: string): ClientAccess {
  return { ...access, scope: 'COMPANY', companyIds: [companyId] };
}

export function createRentalConstructorBootstrap(dependencies: BootstrapDependencies) {
  return async function getBootstrap(access: ClientAccess, options: PreferredOptions = {}) {
    const companies = await dependencies.listCompanies(access);
    if (companies.length === 0) throw new Error('Нет доступной компании для нового договора.');

    const preferredAllowed = companies.some(
      (company) => company.id === options.preferredCompanyId,
    );
    const companyId = preferredAllowed ? (options.preferredCompanyId as string) : companies[0].id;
    const tenantAccess = scopedAccess(access, companyId);
    const [clients, vehicles, template, preferredClient, company] = await Promise.all([
      dependencies.listClients(tenantAccess, companyId),
      dependencies.listVehicles(companyId),
      dependencies.getTemplate(companyId),
      options.preferredClientId
        ? dependencies.getClient(tenantAccess, options.preferredClientId)
        : Promise.resolve(null),
      dependencies.getCompany(companyId),
    ]);
    if (!company) throw new Error('Компания нового договора недоступна.');
    const scopedClients = clients.filter((client) => client.companyId === companyId);
    const documents = await dependencies.listDocuments(
      companyId,
      scopedClients.map((client) => client.id),
    );
    const documentsByClientId = Object.fromEntries(
      scopedClients.map((client) => [
        client.id,
        documents
          .filter((document) => document.clientId === client.id)
          .map((document) => ({
            id: document.id,
            category: document.category,
            title: document.title,
            status: document.status,
            currentVersion: document.currentVersion,
            originalName: document.originalName,
            verifiedMime: document.verifiedMime,
            bytes: document.bytes,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          })),
      ]),
    ) satisfies Record<string, ClientDocumentListItem[]>;

    return {
      companyId,
      company,
      userId: access.user.id,
      companies,
      templateVersionId: template?.id ?? null,
      clients: scopedClients,
      vehicles,
      documentsByClientId,
      preferredClient:
        preferredClient?.companyId === companyId ? preferredClient : null,
    };
  };
}

const getBootstrap = createRentalConstructorBootstrap({
  listCompanies: getClientCompanyOptions,
  listClients: async (access) => {
    const result = await getClients(access, { page: 1, pageSize: 100 });
    return result.items.map((client) => ({
      id: client.id,
      companyId: client.companyId,
      fullName: client.fullName,
      phone: client.phone,
      status: client.status,
    }));
  },
  getClient: async (access, clientId) => {
    const client = await getClientById(access, clientId);
    return client
      ? {
          id: client.id,
          companyId: client.companyId,
          fullName: client.fullName,
          phone: client.phone,
          status: client.status,
        }
      : null;
  },
  listVehicles: listRentalDraftVehicleOptions,
  getTemplate: (companyId) =>
    prisma.contractTemplateVersion.findFirst({
      where: { companyId, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { id: true },
    }),
  getCompany: (companyId) =>
    prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, name: true, contractCity: true },
    }),
  listDocuments: async (companyId, clientIds) => {
    if (clientIds.length === 0) return [];
    const documents = await prisma.clientDocument.findMany({
      where: {
        companyId,
        clientId: { in: [...clientIds] },
        archivedAt: null,
        status: { not: 'ARCHIVED' },
      },
      select: {
        id: true,
        clientId: true,
        category: true,
        title: true,
        status: true,
        currentVersion: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return documents.map((document) => ({
      ...document,
      originalName: null,
      verifiedMime: null,
      bytes: null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    }));
  },
});

export type RentalConstructorBootstrap = Awaited<ReturnType<typeof getBootstrap>>;
export const getRentalConstructorBootstrap = getBootstrap;
