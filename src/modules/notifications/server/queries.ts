import 'server-only';

import { prisma } from '@/database/prisma/client';
import { getAdminCenterAccess } from '@/modules/admin/access';
import { getEventTimeline } from '@/modules/events/server/queries';

import { buildAuditNotifications } from '../domain/build-audit-notifications';
import { buildEventNotifications } from '../domain/build-notifications';
import type { PilotNotification } from '../types';

export async function listNotificationsForCurrentUser() {
  const access = await getAdminCenterAccess();
  const timelinePromise = getEventTimeline({ read: 'all', limit: 30 });

  if (!access) {
    return buildEventNotifications((await timelinePromise).events);
  }

  const [timelineResult, auditRows] = await Promise.all([
    timelinePromise,
    prisma.auditLog.findMany({
      ...(access.scope === 'COMPANY'
        ? { where: { companyId: { in: [...access.companyIds] } } }
        : {}),
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        companyId: true,
        actorEmailSnapshot: true,
        actorUser: { select: { name: true } },
        action: true,
        entityType: true,
        entityId: true,
        entityLabel: true,
        changes: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    }),
  ]);
  const auditKeys = auditRows.map(({ id }) => `audit:${id}`);
  const readAuditKeys = auditKeys.length
    ? new Set(
        (
          await prisma.eventReadReceipt.findMany({
            where: { userId: access.user.id, eventKey: { in: auditKeys } },
            select: { eventKey: true },
          })
        ).map(({ eventKey }) => eventKey),
      )
    : new Set<string>();

  const auditNotifications = buildAuditNotifications(
    auditRows.map((row) => ({
      ...row,
      actorLabel: row.actorUser?.name ?? row.actorEmailSnapshot,
      companyLabel: row.company?.name ?? null,
      isRead: readAuditKeys.has(`audit:${row.id}`),
    })),
  );
  const timelineNotifications = buildEventNotifications(timelineResult.events);

  return [...auditNotifications, ...timelineNotifications]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .filter(
      (notification, index, notifications) =>
        notifications.findIndex(({ id }) => id === notification.id) === index,
    )
    .slice(0, 50) satisfies PilotNotification[];
}
