import { describe, expect, it, vi } from 'vitest';

import { listClientComments } from './queries';

describe('выборка комментариев клиента', () => {
  it('ограничивает комментарии tenant и по умолчанию скрывает архивные', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listClientComments(
      { scope: 'COMPANY', companyIds: ['company-1'], user: { id: 'user-1' } },
      'client-1',
      false,
      { findMany },
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: 'client-1',
          companyId: { in: ['company-1'] },
          hiddenAt: null,
        },
      }),
    );
  });

  it('отдаёт состояние проблемы и только явное ручное влияние в DTO', async () => {
    const createdAt = new Date('2026-08-22T10:00:00.000Z');
    const resolvedAt = new Date('2026-08-22T11:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'comment-1',
        rentalId: null,
        authorUserId: 'user-1',
        category: 'PAYMENT',
        severity: 'WARNING',
        text: 'Оплата после напоминания',
        isPinned: false,
        hiddenAt: null,
        problemStatus: 'RESOLVED',
        affectsRating: true,
        ratingDelta: -15,
        resolvedAt,
        createdAt,
        updatedAt: resolvedAt,
        author: { name: 'Анна' },
        rental: null,
      },
    ]);

    await expect(
      listClientComments(
        { scope: 'COMPANY', companyIds: ['company-1'], user: { id: 'user-1' } },
        'client-1',
        false,
        { findMany },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        problemStatus: 'RESOLVED',
        affectsRating: true,
        ratingDelta: -15,
        resolvedAt: resolvedAt.toISOString(),
      }),
    ]);
  });
});
