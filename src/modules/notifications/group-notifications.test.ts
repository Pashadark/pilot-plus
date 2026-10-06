import { describe, expect, it } from 'vitest';

import type { PilotNotification } from './types';
import { groupNotifications } from './group-notifications';

function notification(overrides: Partial<PilotNotification> = {}): PilotNotification {
  return {
    id: 'event-1',
    category: 'FLEET',
    title: 'Автомобиль изменён',
    description: 'Kia K5 обновлена',
    createdAt: 'Сегодня, 10:00',
    occurredAt: '2026-09-14T07:00:00.000Z',
    tone: 'info',
    href: '/vehicles/car-1',
    actorLabel: 'Павел',
    companyLabel: 'СУПА ПРО',
    ...overrides,
  };
}

describe('groupNotifications', () => {
  it('объединяет одинаковые события объекта и сохраняет все идентификаторы', () => {
    const groups = groupNotifications([
      notification(),
      notification({
        id: 'event-2',
        occurredAt: '2026-09-14T07:05:00.000Z',
        createdAt: 'Сегодня, 10:05',
      }),
      notification({ id: 'event-3', occurredAt: '2026-09-14T07:03:00.000Z' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      count: 3,
      notificationIds: ['event-1', 'event-2', 'event-3'],
      latestOccurredAt: '2026-09-14T07:05:00.000Z',
    });
    expect(groups[0]?.representative.id).toBe('event-2');
  });

  it('не объединяет разные объекты или категории и сортирует по последнему событию', () => {
    const groups = groupNotifications([
      notification({ id: 'old', href: '/vehicles/car-1' }),
      notification({ id: 'new', href: '/vehicles/car-2', occurredAt: '2026-09-14T08:00:00.000Z' }),
      notification({ id: 'fine', category: 'FINE', href: '/vehicles/car-1' }),
    ]);

    expect(groups.map(({ representative }) => representative.id)).toEqual(['new', 'old', 'fine']);
  });
});
