import { describe, expect, it, vi } from 'vitest';

import { createFineRatingInput, recordAutomaticRatingEvent } from './automatic-events';

describe('automatic client rating events', () => {
  it('records an automatic event once for its deterministic source key', async () => {
    const insertedKeys = new Set<string>();
    const transaction = {
      clientRatingEvent: {
        createMany: vi.fn(async ({ data }: { data: Array<{ idempotencyKey: string }> }) => {
          const [event] = data;
          if (insertedKeys.has(event.idempotencyKey)) return { count: 0 };
          insertedKeys.add(event.idempotencyKey);
          return { count: 1 };
        }),
      },
    };
    const cleanRental = {
      companyId: 'company-a',
      clientId: 'client-a',
      rentalId: 'rental-a',
      type: 'CLEAN_RENTAL' as const,
      reason: 'CLEAN_RENTAL_COMPLETED' as const,
      delta: 8,
      idempotencyKey: 'rental:rental-a:clean-completion',
    };

    await expect(recordAutomaticRatingEvent(transaction, cleanRental)).resolves.toBe(true);
    await expect(recordAutomaticRatingEvent(transaction, cleanRental)).resolves.toBe(false);
    expect(transaction.clientRatingEvent.createMany).toHaveBeenLastCalledWith({
      data: [{ ...cleanRental, source: 'AUTOMATIC', actorUserId: null }],
      skipDuplicates: true,
    });
  });

  it('does not build a fine event before confirmed unpaid overdue attribution', () => {
    expect(createFineRatingInput({ assignment: 'CANDIDATE', overdue: true })).toBeNull();
    expect(createFineRatingInput({ assignment: 'CONFIRMED', overdue: false })).toBeNull();
    expect(createFineRatingInput({ assignment: 'CONFIRMED', overdue: true })).toMatchObject({
      type: 'UNPAID_CONFIRMED_FINE',
      reason: 'UNPAID_CONFIRMED_FINE',
      delta: -15,
    });
  });
});
