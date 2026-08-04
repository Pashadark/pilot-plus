import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { AdminCenterAccess } from '@/modules/admin/access';

import type { AuditLogItem } from './types';

export async function getRecentAuditLog(
  access: AdminCenterAccess,
  limit = 8,
): Promise<readonly AuditLogItem[]> {
  const take = Number.isFinite(limit) ? Math.min(50, Math.max(1, Math.trunc(limit))) : 8;
  const rows = await prisma.auditLog.findMany({
    ...(access.scope === 'COMPANY' ? { where: { companyId: { in: [...access.companyIds] } } } : {}),
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      actorEmailSnapshot: true,
      actorUser: { select: { name: true } },
      action: true,
      entityType: true,
      entityLabel: true,
      createdAt: true,
      company: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    actorLabel: row.actorUser?.name ?? row.actorEmailSnapshot,
    action: row.action,
    entityType: row.entityType,
    entityLabel: row.entityLabel,
    companyLabel: row.company?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
