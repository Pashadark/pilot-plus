import 'server-only';

import type { CompanyRole } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { readSession } from '@/services/auth/session';

export interface VehicleManagementAccess {
  user: SafeUser;
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
  archiveCompanyIds: readonly string[];
}

export class VehicleManagementAccessDeniedError extends Error {
  constructor() {
    super('Управление автопарком недоступно.');
    this.name = 'VehicleManagementAccessDeniedError';
  }
}

export function canManageVehicles(role: CompanyRole): boolean {
  return role === 'COMPANY_ADMIN' || role === 'DISPATCHER';
}

export function canManageVehicleCompany(
  access: VehicleManagementAccess | null,
  companyId: string,
): boolean {
  return Boolean(access && (access.scope === 'SYSTEM' || access.companyIds.includes(companyId)));
}

export async function getVehicleManagementAccess(): Promise<VehicleManagementAccess | null> {
  const user = await readSession();
  if (!user) return null;

  if (user.role === 'SUPER_ADMIN') {
    return { user, scope: 'SYSTEM', companyIds: [], archiveCompanyIds: [] };
  }

  const memberships = await prisma.companyMember.findMany({
    where: { userId: user.id },
    select: { companyId: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  const companyIds = memberships
    .filter(({ role }) => canManageVehicles(role))
    .map(({ companyId }) => companyId);
  if (companyIds.length === 0) return null;

  return {
    user,
    scope: 'COMPANY',
    companyIds,
    archiveCompanyIds: memberships
      .filter(({ role }) => role === 'COMPANY_ADMIN')
      .map(({ companyId }) => companyId),
  };
}

export function canArchiveVehicleCompany(
  access: VehicleManagementAccess,
  companyId: string,
): boolean {
  return access.scope === 'SYSTEM' || access.archiveCompanyIds.includes(companyId);
}

export async function requireVehicleManagementAccess(
  companyId: string,
): Promise<VehicleManagementAccess> {
  const access = await getVehicleManagementAccess();
  if (!access || !canManageVehicleCompany(access, companyId)) {
    throw new VehicleManagementAccessDeniedError();
  }
  return access;
}
