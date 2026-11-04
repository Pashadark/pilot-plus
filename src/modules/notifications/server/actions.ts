'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { getAdminCenterAccess } from '@/modules/admin/access';
import { markEventReadAction, markEventsReadAction } from '@/modules/events/actions';
import { parseEventKey } from '@/modules/events/event-key';
import { markLowFuelNotificationsRead } from './low-fuel';
import { getNotificationPage } from './queries';
import type { NotificationCursor } from '../pagination';

export async function loadNotificationPageAction(cursor: NotificationCursor) {
  return getNotificationPage(cursor, false);
}

export async function markEntireInboxReadAction(): Promise<NotificationActionState> {
  let cursor: NotificationCursor | null = null;
  do {
    const page = await getNotificationPage(cursor, false);
    const ids = page.items.filter((item) => !item.isRead).map((item) => item.id);
    if (ids.length) {
      const result = await markAllNotificationsReadAction(ids);
      if (result.status === 'error') return result;
    }
    cursor = page.nextCursor;
  } while (cursor);
  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Все уведомления прочитаны.' };
}

type NotificationActionState = { status: 'idle' | 'success' | 'error'; message: string };

const INVALID_NOTIFICATION: NotificationActionState = {
  status: 'error',
  message: 'Уведомление недоступно.',
};

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionState> {
  const parsed = parseEventKey(notificationId);
  if (!parsed) return INVALID_NOTIFICATION;
  if (parsed.source === 'low-fuel') {
    if (!(await markLowFuelNotificationsRead([notificationId]))) return INVALID_NOTIFICATION;
    revalidatePath('/', 'layout');
    return { status: 'success', message: 'Уведомление отмечено прочитанным.' };
  }
  if (parsed.source !== 'audit') return markEventReadAction(notificationId);

  const access = await getAdminCenterAccess();
  if (!access) return INVALID_NOTIFICATION;

  const audit = await prisma.auditLog.findFirst({
    where: {
      id: parsed.id,
      ...(access.scope === 'COMPANY' ? { companyId: { in: [...access.companyIds] } } : {}),
    },
    select: { companyId: true },
  });
  if (!audit?.companyId) return INVALID_NOTIFICATION;

  await prisma.eventReadReceipt.upsert({
    where: { userId_eventKey: { userId: access.user.id, eventKey: notificationId } },
    create: { companyId: audit.companyId, userId: access.user.id, eventKey: notificationId },
    update: { readAt: new Date() },
  });
  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Уведомление отмечено прочитанным.' };
}

export async function markAllNotificationsReadAction(
  notificationIds: readonly string[],
): Promise<NotificationActionState> {
  const uniqueIds = [...new Set(notificationIds)].slice(0, 50);
  const parsed = uniqueIds.map((id) => ({ id, parsed: parseEventKey(id) }));
  if (parsed.some(({ parsed: value }) => !value)) return INVALID_NOTIFICATION;

  const auditIds = parsed.filter(({ parsed: value }) => value?.source === 'audit');
  const fuelIds = parsed
    .filter(({ parsed: value }) => value?.source === 'low-fuel')
    .map(({ id }) => id);
  const eventIds = parsed
    .filter(({ parsed: value }) => value?.source !== 'audit' && value?.source !== 'low-fuel')
    .map(({ id }) => id);
  if (fuelIds.length && !(await markLowFuelNotificationsRead(fuelIds))) return INVALID_NOTIFICATION;
  const access = auditIds.length ? await getAdminCenterAccess() : null;
  if (auditIds.length && !access) return INVALID_NOTIFICATION;

  if (auditIds.length && access) {
    const sourceIds = auditIds.map(({ parsed: value }) => value!.id);
    const rows = await prisma.auditLog.findMany({
      where: {
        id: { in: sourceIds },
        companyId: { not: null },
        ...(access.scope === 'COMPANY' ? { companyId: { in: [...access.companyIds] } } : {}),
      },
      select: { id: true, companyId: true },
    });
    await Promise.all(
      rows.flatMap((row) => {
        if (!row.companyId) return [];
        const eventKey = `audit:${row.id}`;
        return [
          prisma.eventReadReceipt.upsert({
            where: { userId_eventKey: { userId: access.user.id, eventKey } },
            create: { companyId: row.companyId, userId: access.user.id, eventKey },
            update: { readAt: new Date() },
          }),
        ];
      }),
    );
  }

  if (eventIds.length) {
    const result = await markEventsReadAction(eventIds);
    if (result.status === 'error') return result;
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Все уведомления отмечены прочитанными.' };
}
