import { describe, expect, it, vi } from 'vitest';

import { createBotRentalRequest } from './rental-requests';

const identity = {
  identityId: 'identity-1',
  telegramUserId: '12345',
  kind: 'CLIENT' as const,
  companyId: 'company-1',
  clientId: 'client-1',
  userId: null,
  displayName: 'Иван',
};
const input = {
  startsAt: '2026-09-01T09:00:00+03:00',
  endsAt: '2026-09-05T09:00:00+03:00',
  preferredVehicleId: 'vehicle-1',
  fulfillmentMode: 'OFFICE' as const,
  deliveryAddress: null,
  comment: null,
  rentalId: null,
};

describe('createBotRentalRequest', () => {
  it('returns the existing request for a repeated company idempotency key', async () => {
    const existing = {
      id: 'request-1',
      companyId: 'company-1',
      clientId: 'client-1',
      status: 'PENDING',
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      fulfillmentMode: 'OFFICE',
      preferredVehicleId: 'vehicle-1',
      rentalId: null,
      createdAt: new Date('2026-08-19T10:00:00Z'),
    };
    const tx = { botRentalRequest: { findUnique: vi.fn().mockResolvedValue(existing) } };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const result = await createBotRentalRequest(identity, input, 'tg-update-77', database as never);
    expect(result.id).toBe('request-1');
    expect(tx.botRentalRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_idempotencyKey: { companyId: 'company-1', idempotencyKey: 'tg-update-77' },
        },
      }),
    );
  });

  it('rejects a delivery request without an address before writing', async () => {
    const database = { $transaction: vi.fn() };
    await expect(
      createBotRentalRequest(
        identity,
        { ...input, fulfillmentMode: 'DELIVERY', deliveryAddress: null },
        'tg-update-78',
        database as never,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 });
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
