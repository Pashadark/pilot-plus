import 'server-only';

import { prisma } from '@/database/prisma/client';
import { getAdminCenterAccess } from '@/modules/admin/access';
import { getEventTimeline } from '@/modules/events/server/queries';

import { buildAuditNotifications } from '../domain/build-audit-notifications';
import { buildEventNotifications } from '../domain/build-notifications';
import type { PilotNotification } from '../types';
import { listLowFuelNotifications } from './low-fuel';
import { Prisma } from '@/database/generated/prisma';
import { paginateNotifications, type NotificationCursor } from '../pagination';

export async function getNotificationPage(
  cursor: NotificationCursor | null = null,
  includeCount = true,
) {
  if (
    cursor &&
    (!Number.isFinite(Date.parse(cursor.before)) ||
      !cursor.beforeKey ||
      cursor.beforeKey.length > 200 ||
      (cursor.asOf && !Number.isFinite(Date.parse(cursor.asOf))))
  )
    throw new Error('Некорректная страница уведомлений.');
  const asOf = cursor?.asOf ?? new Date().toISOString();
  const access = await getAdminCenterAccess();
  const [fuel, timeline] = await Promise.all([
    listLowFuelNotifications(),
    getEventTimeline(
      {
        read: 'all',
        limit: 21,
        to: asOf,
        categories: ['ALERT', 'FUEL', 'MAINTENANCE', 'WASH', 'DEVICE', 'FIRMWARE', 'MANUAL'],
        ...(cursor ? { before: cursor.before, beforeKey: cursor.beforeKey } : {}),
      },
      { allHistory: true, includeStats: includeCount },
    ),
  ]);
  let auditNotifications: PilotNotification[] = [];
  let auditUnread = 0;
  if (access) {
    const where: Prisma.AuditLogWhereInput = {
      companyId: access.scope === 'COMPANY' ? { in: [...access.companyIds] } : { not: null },
      createdAt: { lte: new Date(asOf) },
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.before) } },
              {
                createdAt: new Date(cursor.before),
                ...(cursor.beforeKey.startsWith('audit:')
                  ? { id: { gt: cursor.beforeKey.slice(6) } }
                  : cursor.beforeKey < 'audit:'
                    ? {}
                    : { id: { in: [] } }),
              },
            ],
          }
        : {}),
    };
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 21,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        entityLabel: true,
        changes: true,
        createdAt: true,
        actorEmailSnapshot: true,
        actorUser: { select: { name: true } },
        company: { select: { name: true } },
      },
    });
    const receipts = rows.length
      ? await prisma.eventReadReceipt.findMany({
          where: { userId: access.user.id, eventKey: { in: rows.map((row) => `audit:${row.id}`) } },
          select: { eventKey: true },
        })
      : [];
    const read = new Set(receipts.map((row) => row.eventKey));
    auditNotifications = buildAuditNotifications(
      rows.map((row) => ({
        ...row,
        actorLabel: row.actorUser?.name ?? row.actorEmailSnapshot,
        companyLabel: row.company?.name ?? null,
        isRead: read.has(`audit:${row.id}`),
      })),
    );
    if (includeCount) {
      const scope =
        access.scope === 'COMPANY'
          ? access.companyIds.length
            ? Prisma.sql`AND a."companyId" IN (${Prisma.join([...access.companyIds])})`
            : Prisma.sql`AND FALSE`
          : Prisma.empty;
      const counts = await prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS count FROM "AuditLog" a WHERE a."companyId" IS NOT NULL AND a."createdAt" <= ${new Date(asOf)} ${scope} AND NOT EXISTS (SELECT 1 FROM "EventReadReceipt" r WHERE r."userId" = ${access.user.id} AND r."eventKey" = 'audit:' || a.id)`,
      );
      auditUnread = Number(counts[0]?.count ?? 0);
    }
  }
  const result = paginateNotifications(
    [
      ...fuel.filter((item) => item.occurredAt <= asOf),
      ...auditNotifications,
      ...buildEventNotifications(timeline.events),
    ],
    cursor,
  );
  return {
    ...result,
    nextCursor: result.nextCursor ? { ...result.nextCursor, asOf } : null,
    unreadCount:
      auditUnread +
      (timeline.stats?.unread ?? 0) +
      fuel.filter((item) => !item.isRead && item.occurredAt <= asOf).length,
  };
}

export async function listNotificationsForCurrentUser() {
  const access = await getAdminCenterAccess();
  const lowFuelPromise = listLowFuelNotifications();
  // Filter before pagination so fresh positions cannot crowd out important events.
  const timelinePromise = getEventTimeline({
    read: 'all',
    limit: 30,
    categories: ['ALERT', 'FUEL', 'MAINTENANCE', 'WASH', 'DEVICE', 'FIRMWARE', 'MANUAL'],
  });

  if (!access) {
    return [...(await lowFuelPromise), ...buildEventNotifications((await timelinePromise).events)]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 50);
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

  return [...(await lowFuelPromise), ...auditNotifications, ...timelineNotifications]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .filter(
      (notification, index, notifications) =>
        notifications.findIndex(({ id }) => id === notification.id) === index,
    )
    .slice(0, 50) satisfies PilotNotification[];
}
