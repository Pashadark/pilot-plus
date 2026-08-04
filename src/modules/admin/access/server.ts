import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { readSession } from '@/services/auth/session';

export interface AdminCenterAccess {
  user: SafeUser;
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
}

export class AdminAccessDeniedError extends Error {
  constructor() {
    super('Доступ к центру администрирования запрещён.');
    this.name = 'AdminAccessDeniedError';
  }
}

export async function getAdminCenterAccess(): Promise<AdminCenterAccess | null> {
  const user = await readSession();
  if (!user) return null;

  if (user.role === 'SUPER_ADMIN') {
    return { user, scope: 'SYSTEM', companyIds: [] };
  }

  if (!user.canAccessAdmin) return null;

  const memberships = await prisma.companyMember.findMany({
    where: { userId: user.id, role: 'COMPANY_ADMIN' },
    select: { companyId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (memberships.length === 0) return null;

  return {
    user,
    scope: 'COMPANY',
    companyIds: memberships.map(({ companyId }) => companyId),
  };
}

export async function requireAdminCenterAccess(): Promise<AdminCenterAccess> {
  const access = await getAdminCenterAccess();
  if (!access) throw new AdminAccessDeniedError();
  return access;
}
