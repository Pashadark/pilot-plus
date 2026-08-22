import { describe, expect, it, vi } from 'vitest';

import { recordAutomaticRatingEvent } from './automatic-events';
import { getClientRating } from './queries';

describe('client reliability rating integration', () => {
  it('projects one clean return, one on-time return, and one manual problem exactly once', async () => {
    const recordedKeys = new Set<string>();
    const events: Array<{
      id: string;
      delta: number;
      type: string;
      reason: string;
      createdAt: Date;
    }> = [];
    const comments: Array<{ severity: string }> = [];
    const transaction = {
      clientRatingEvent: {
        createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
          const [event] = data;
          const idempotencyKey = String(event.idempotencyKey);
          if (recordedKeys.has(idempotencyKey)) return { count: 0 };
          recordedKeys.add(idempotencyKey);
          events.push({
            id: `event-${events.length + 1}`,
            delta: Number(event.delta),
            type: String(event.type),
            reason: String(event.reason),
            createdAt: new Date('2026-08-22T12:00:00.000Z'),
          });
          return { count: 1 };
        }),
      },
    };

    const cleanRental = {
      companyId: 'company-a',
      clientId: 'client-a',
      rentalId: 'rental-a',
      vehicleId: 'vehicle-a',
      type: 'CLEAN_RENTAL' as const,
      reason: 'CLEAN_RENTAL_COMPLETED' as const,
      delta: 8,
      idempotencyKey: 'rental:rental-a:clean-completion',
    };
    const onTimeReturn = {
      ...cleanRental,
      type: 'ON_TIME_RETURN' as const,
      reason: 'ON_TIME_RETURN_COMPLETED' as const,
      delta: 2,
      idempotencyKey: 'rental:rental-a:on-time-return',
    };

    await expect(recordAutomaticRatingEvent(transaction, cleanRental)).resolves.toBe(true);
    await expect(recordAutomaticRatingEvent(transaction, onTimeReturn)).resolves.toBe(true);
    await expect(recordAutomaticRatingEvent(transaction, cleanRental)).resolves.toBe(false);

    comments.push({ severity: 'WARNING' });
    events.push({
      id: 'event-manual-problem',
      delta: -15,
      type: 'MANUAL_NEGATIVE',
      reason: 'MANUAL_COMMENT',
      createdAt: new Date('2026-08-22T12:01:00.000Z'),
    });

    const repository = {
      findFirst: vi.fn().mockResolvedValue({
        id: 'client-a',
        _count: { rentals: 1 },
        ratingEvents: events,
        comments,
      }),
    };
    const rating = await getClientRating(
      {
        scope: 'COMPANY',
        companyIds: ['company-a'],
        user: { id: 'admin-a' },
        canManage: true,
      } as never,
      'client-a',
      repository,
    );

    expect(rating).toMatchObject({
      score: 50,
      stars: 2,
      openProblemCount: 1,
      eventCount: 3,
    });
    expect(transaction.clientRatingEvent.createMany).toHaveBeenCalledTimes(3);
  });
});
