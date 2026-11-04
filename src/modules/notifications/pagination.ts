import type { PilotNotification } from './types';

export type NotificationCursor = { before: string; beforeKey: string; asOf?: string };
export type NotificationMeta = { unreadCount: number; nextCursor: NotificationCursor | null };
export function paginateNotifications(
  items: readonly PilotNotification[],
  cursor: NotificationCursor | null,
) {
  const sorted = [...new Map(items.map((item) => [item.id, item])).values()]
    .filter(
      (item) =>
        !cursor ||
        item.occurredAt < cursor.before ||
        (item.occurredAt === cursor.before && item.id > cursor.beforeKey),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  const page = sorted.slice(0, 20);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      sorted.length > 20 && last
        ? { before: last.occurredAt, beforeKey: last.id, asOf: cursor?.asOf }
        : null,
  };
}
