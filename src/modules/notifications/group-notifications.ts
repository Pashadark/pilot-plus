import type { PilotNotification } from './types';

export interface NotificationGroup {
  key: string;
  representative: PilotNotification;
  notificationIds: string[];
  count: number;
  latestOccurredAt: string;
}

function notificationGroupKey(notification: PilotNotification) {
  return [
    notification.category,
    notification.title,
    notification.href,
    notification.actorLabel ?? '',
    notification.companyLabel ?? '',
  ].join('\u001f');
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function groupNotifications(notifications: PilotNotification[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  for (const notification of notifications) {
    const key = notificationGroupKey(notification);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        representative: notification,
        notificationIds: [notification.id],
        count: 1,
        latestOccurredAt: notification.occurredAt,
      });
      continue;
    }

    existing.notificationIds.push(notification.id);
    existing.count += 1;

    if (timestamp(notification.occurredAt) > timestamp(existing.latestOccurredAt)) {
      existing.representative = notification;
      existing.latestOccurredAt = notification.occurredAt;
    }
  }

  return [...groups.values()].sort(
    (left, right) => timestamp(right.latestOccurredAt) - timestamp(left.latestOccurredAt),
  );
}
