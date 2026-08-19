import { describe, expect, it, vi } from 'vitest';

import { createRentalDocumentGrant, listClientRentals, resolveBotIdentity } from './queries';

describe('bot client queries', () => {
  it('resolves only an active linked client', async () => {
    const database = {
      telegramIdentity: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'identity-1',
          companyId: 'company-1',
          clientId: 'client-1',
          userId: null,
          kind: 'CLIENT',
          client: { firstName: 'Иван', lastName: 'Иванов' },
        }),
      },
    };
    await expect(resolveBotIdentity('12345', database as never)).resolves.toMatchObject({
      companyId: 'company-1',
      clientId: 'client-1',
    });
    expect(database.telegramIdentity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ telegramUserId: '12345', isActive: true }),
      }),
    );
  });

  it('lists rentals through exact company and client scope', async () => {
    const database = {
      rental: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'own-rental',
            contractNumber: 'ME-1',
            status: 'ACTIVE',
            startsAt: new Date('2026-08-01T06:00:00Z'),
            endsAt: new Date('2026-08-02T06:00:00Z'),
            totalPriceMinor: BigInt(1000),
            depositMinor: BigInt(500),
            vehicle: {
              make: 'Kia',
              modelName: 'K5',
              model: 'K5',
              registrationNumber: 'А001АА777',
            },
            documentGenerations: [{ status: 'COMMITTED' }],
          },
        ]),
      },
    };
    const result = await listClientRentals(
      {
        identityId: 'identity-1',
        telegramUserId: '12345',
        kind: 'CLIENT',
        companyId: 'company-1',
        clientId: 'client-1',
        userId: null,
        displayName: 'Иван',
      },
      database as never,
    );
    expect(result.map((r) => r.id)).toEqual(['own-rental']);
    expect(database.rental.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1', clientId: 'client-1' } }),
    );
    expect(result[0]?.totalPriceMinor).toBe('1000');
  });

  it('does not grant a document outside the linked client scope', async () => {
    const database = { rental: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(
      createRentalDocumentGrant(
        {
          identityId: 'identity-1',
          telegramUserId: '12345',
          kind: 'CLIENT',
          companyId: 'company-1',
          clientId: 'client-1',
          userId: null,
          displayName: 'Иван',
        },
        'foreign-rental',
        database as never,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
