import { expect, it } from 'vitest';
import { paginateNotifications } from './pagination';
import type { PilotNotification } from './types';

it('uses a stable date and id cursor with no duplicates at equal timestamps', () => {
  const items = Array.from(
    { length: 45 },
    (_, i) =>
      ({
        id: `audit:${String(i).padStart(3, '0')}`,
        occurredAt: '2026-10-19T10:00:00.000Z',
      }) as PilotNotification,
  );
  const first = paginateNotifications(items, null);
  const second = paginateNotifications(items, first.nextCursor);
  expect(first.items).toHaveLength(20);
  expect(second.items).toHaveLength(20);
  expect(new Set([...first.items, ...second.items].map((x) => x.id)).size).toBe(40);
});
