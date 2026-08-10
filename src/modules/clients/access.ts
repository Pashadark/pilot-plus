import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { CompanyPermissionValue } from '@/modules/admin/access/permissions';
import type { SafeUser } from '@/modules/auth/types';
import { readSession } from '@/services/auth/session';

export type ClientPermission = Extract<CompanyPermissionValue, 'VIEW_CLIENTS' | 'MANAGE_CLIENTS'>;

export interface ClientAccess {
  user: SafeUser;
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
  canManage: boolean;
}

function roleAllowsClientPermission(
  role: 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER',
  permission: ClientPermission,
): boolean {
  if (permission === 'MANAGE_CLIENTS') {
    return role === 'COMPANY_ADMIN' || role === 'DISPATCHER';
  }
  return role !== 'DRIVER';
}

export function canManageClient(access: ClientAccess | null, companyId: string): boolean {
  return Boolean(
    access &&
    access.canManage &&
    (access.scope === 'SYSTEM' || access.companyIds.includes(companyId)),
  );
}

export async function canArchiveClient(
  access: ClientAccess | null,
  companyId: string,
): Promise<boolean> {
  if (!canManageClient(access, companyId) || !access) return false;
  if (access.scope === 'SYSTEM') return true;

  const membership = await prisma.companyMember.findFirst({
    where: {
      userId: access.user.id,
      companyId,
      role: 'COMPANY_ADMIN',
    },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function getClientAccess(permission: ClientPermission): Promise<ClientAccess | null> {
  const user = await readSession();
  if (!user) return null;

  if (user.role === 'SUPER_ADMIN') {
    return { user, scope: 'SYSTEM', companyIds: [], canManage: true };
  }

  const memberships = await prisma.companyMember.findMany({
    where: { userId: user.id },
    select: { companyId: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  const companyIds = memberships
    .filter(({ role }) => roleAllowsClientPermission(role, permission))
    .map(({ companyId }) => companyId);
  if (companyIds.length === 0) return null;

  return {
    user,
    scope: 'COMPANY',
    companyIds,
    canManage: permission === 'MANAGE_CLIENTS',
  };
}

export async function requireClientAccess(permission: ClientPermission): Promise<ClientAccess> {
  const access = await getClientAccess(permission);
  if (!access) throw new Error('Доступ к клиентам запрещён.');
  return access;
}
