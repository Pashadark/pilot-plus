import 'server-only';

import type { CompanyRole } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { readSession } from '@/services/auth/session';

export interface RentalAccess {
  user: SafeUser;
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
}

export class RentalAccessDeniedError extends Error {
  constructor() {
    super('Доступ к договорам аренды запрещён.');
    this.name = 'RentalAccessDeniedError';
  }
}

export function canManageRentals(role: CompanyRole): boolean {
  return role === 'COMPANY_ADMIN' || role === 'DISPATCHER';
}

export function canAccessRentalCompany(access: RentalAccess | null, companyId: string): boolean {
  return Boolean(access && (access.scope === 'SYSTEM' || access.companyIds.includes(companyId)));
}

export async function getRentalAccess(): Promise<RentalAccess | null> {
  const user = await readSession();
  if (!user) return null;

  if (user.role === 'SUPER_ADMIN') {
    return { user, scope: 'SYSTEM', companyIds: [] };
  }

  const memberships = await prisma.companyMember.findMany({
    where: { userId: user.id },
    select: { companyId: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  const companyIds = memberships
    .filter(({ role }) => canManageRentals(role))
    .map(({ companyId }) => companyId);
  if (companyIds.length === 0) return null;

  return { user, scope: 'COMPANY', companyIds };
}

export async function requireRentalAccess(companyId: string): Promise<RentalAccess> {
  const access = await getRentalAccess();
  if (!access || !canAccessRentalCompany(access, companyId)) {
    throw new RentalAccessDeniedError();
  }
  return access;
}
