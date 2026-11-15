import 'server-only';

import { prisma } from '@/database/prisma/client';
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
    const [clients, vehicles, template, preferredClient] = await Promise.all([
      dependencies.listClients(tenantAccess, companyId),
      dependencies.listVehicles(companyId),
      dependencies.getTemplate(companyId),
      options.preferredClientId
        ? dependencies.getClient(tenantAccess, options.preferredClientId)
        : Promise.resolve(null),
    ]);

    return {
      companyId,
      companies,
      templateVersionId: template?.id ?? null,
      clients: clients.filter((client) => client.companyId === companyId),
      vehicles,
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
});

export type RentalConstructorBootstrap = Awaited<ReturnType<typeof getBootstrap>>;
export const getRentalConstructorBootstrap = getBootstrap;
