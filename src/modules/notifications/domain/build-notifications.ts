import type { TimelineEventDto } from '@/modules/events/types';
import type { PilotNotification } from '../types';

const tones = { INFO: 'info', WARNING: 'warning', DANGER: 'danger' } as const;

export function buildEventNotifications(events: readonly TimelineEventDto[]): PilotNotification[] {
  const seen = new Set<string>();
  return events.flatMap((event) => {
    if (seen.has(event.key)) return [];
    seen.add(event.key);
    return [{ id: event.key, title: event.title, description: event.description ?? event.vehicle.model,
      createdAt: new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(event.recordedAt)),
      tone: tones[event.severity], href: event.source.href ?? `/vehicles/${event.vehicle.id}`, isRead: event.isRead }];
  });
}
