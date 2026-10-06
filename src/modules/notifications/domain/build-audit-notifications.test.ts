import { describe, expect, it } from 'vitest';

import { buildAuditNotifications } from './build-audit-notifications';

const base = {
  actorLabel: 'Павел Седов',
  companyLabel: 'СУПА ПРО',
  createdAt: new Date('2026-09-14T07:30:00.000Z'),
  isRead: false,
};

describe('buildAuditNotifications', () => {
  it.each([
    {
      row: {
        ...base,
        id: 'rental-start',
        action: 'UPDATE' as const,
        entityType: 'RENTAL' as const,
        entityId: 'rental-1',
        entityLabel: 'ME-2026-0091-GA',
        changes: { type: 'HANDOVER' },
      },
      expected: {
        id: 'audit:rental-start',
        category: 'RENTAL',
        title: 'Аренда началась',
        href: '/rentals/rental-1',
        tone: 'success',
      },
    },
    {
      row: {
        ...base,
        id: 'rental-return',
        action: 'UPDATE' as const,
        entityType: 'RENTAL' as const,
        entityId: 'rental-1',
        entityLabel: 'ME-2026-0030-GA',
        changes: { type: 'RETURN' },
      },
      expected: {
        id: 'audit:rental-return',
        category: 'RENTAL',
        title: 'Аренда завершена',
        href: '/rentals/rental-1',
        tone: 'info',
      },
    },
    {
      row: {
        ...base,
        id: 'fine-created',
        action: 'CREATE' as const,
        entityType: 'FINE' as const,
        entityId: 'fine-1',
        entityLabel: 'Штраф',
        changes: null,
      },
      expected: {
        id: 'audit:fine-created',
        category: 'FINE',
        title: 'Новый штраф',
        href: '/fines',
        tone: 'warning',
      },
    },
    {
      row: {
        ...base,
        id: 'comment-created',
        action: 'CREATE' as const,
        entityType: 'CLIENT' as const,
        entityId: 'client-1',
        entityLabel: 'Внутренний комментарий клиента',
        changes: { commentId: 'comment-1' },
      },
      expected: {
        id: 'audit:comment-created',
        category: 'CLIENT',
        title: 'Комментарий добавлен',
        href: '/clients/client-1',
        tone: 'info',
      },
    },
  ])('создаёт предметное уведомление $expected.title', ({ row, expected }) => {
    expect(buildAuditNotifications([row])).toEqual([
      expect.objectContaining({
        ...expected,
        actorLabel: 'Павел Седов',
        companyLabel: 'СУПА ПРО',
        occurredAt: '2026-09-14T07:30:00.000Z',
        isRead: false,
      }),
    ]);
  });
});
