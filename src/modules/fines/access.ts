import 'server-only';

import type { CompanyRole, UserRole } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { readSession } from '@/services/auth/session';

import type { FineAccess } from './types';

export class FineAccessDeniedError extends Error {
  constructor() {
    super('Доступ к штрафам запрещён.');
    this.name = 'FineAccessDeniedError';
  }
}

export function canManageFines(role: CompanyRole): boolean {
  return role === 'COMPANY_ADMIN' || role === 'DISPATCHER';
}

export function canConfigureFineIntegration(role: UserRole | CompanyRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN';
}

export function canAccessFineCompany(access: FineAccess | null, companyId: string): boolean {
  return Boolean(access && (access.scope === 'SYSTEM' || access.companyIds.includes(companyId)));
}

export async function getFineAccessForUser(user: SafeUser): Promise<FineAccess | null> {
  if (user.role === 'SUPER_ADMIN') {
    return { user, scope: 'SYSTEM', companyIds: [], rolesByCompany: {} };
  }

  const memberships = await prisma.companyMember.findMany({
    where: { userId: user.id },
    select: { companyId: true, role: true, additionalPermissions: true },
    orderBy: { createdAt: 'asc' },
  });
  const allowed = memberships.filter(({ role }) => canManageFines(role));
  if (allowed.length === 0) return null;

  return {
    user,
    scope: 'COMPANY',
    companyIds: allowed.map(({ companyId }) => companyId),
    rolesByCompany: Object.fromEntries(allowed.map(({ companyId, role }) => [companyId, role])),
  };
}

export async function getFineAccess(): Promise<FineAccess | null> {
  const user = await readSession();
  return user ? getFineAccessForUser(user) : null;
}

export async function requireFineViewAccess(companyId?: string): Promise<FineAccess> {
  const access = await getFineAccess();
  if (!access || (companyId && !canAccessFineCompany(access, companyId))) {
    throw new FineAccessDeniedError();
  }
  return access;
}

export async function requireFineManageAccess(companyId: string): Promise<FineAccess> {
  return requireFineViewAccess(companyId);
}
