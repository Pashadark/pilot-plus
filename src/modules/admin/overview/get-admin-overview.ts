import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { AdminCenterAccess } from '@/modules/admin/access';
import { getRecentAuditLog } from '@/modules/admin/audit';

import type { AdminOverview } from './types';

export async function getAdminOverview(access: AdminCenterAccess): Promise<AdminOverview> {
  if (access.scope === 'SYSTEM') {
    const [companies, users, vehicles, devices, recentAudit] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.vehicle.count(),
      prisma.device.count(),
      getRecentAuditLog(access),
    ]);

    return { scope: access.scope, companies, users, vehicles, devices, recentAudit };
  }

  const companyIds = [...access.companyIds];
  const [companies, memberships, vehicles, devices, recentAudit] = await Promise.all([
    prisma.company.count({ where: { id: { in: companyIds } } }),
    prisma.companyMember.findMany({
      where: { companyId: { in: companyIds } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.vehicle.count({ where: { companyId: { in: companyIds } } }),
    prisma.device.count({ where: { companyId: { in: companyIds } } }),
    getRecentAuditLog(access),
  ]);

  return {
    scope: access.scope,
    companies,
    users: memberships.length,
    vehicles,
    devices,
    recentAudit,
  };
}
