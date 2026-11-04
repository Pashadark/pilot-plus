import { describe, expect, it, vi } from 'vitest';

import {
  createRentalDocumentGrant,
  listClientDepositBalances,
  listClientRentals,
  resolveBotIdentity,
} from './queries';

describe('bot client queries', () => {
  it('rejects a staff identity after company membership is removed', async () => {
    const database = {
      telegramIdentity: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'i', companyId: 'a', kind: 'STAFF', userId: 'u', user: { role: 'USER' } },
          ]),
      },
      companyMember: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    await expect(resolveBotIdentity('12345', database as never)).rejects.toThrow('FORBIDDEN');
  });
  it('rejects ambiguous Telegram identities instead of choosing another company', async () => {
    const identity = { id: 'i', companyId: 'a', kind: 'CLIENT', clientId: 'c', client: {} };
    const database = {
      telegramIdentity: {
        findFirst: vi.fn().mockResolvedValue(identity),
        findMany: vi.fn().mockResolvedValue([identity, { ...identity, companyId: 'b' }]),
      },
    };
    await expect(resolveBotIdentity('12345', database as never)).rejects.toThrow(
      'IDENTITY_REQUIRED',
    );
  });
  it('resolves only an active linked client', async () => {
    const database = {
      telegramIdentity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'identity-1',
            companyId: 'company-1',
            clientId: 'client-1',
            userId: null,
            kind: 'CLIENT',
            client: { firstName: 'Иван', lastName: 'Иванов' },
          },
        ]),
      },
    };
    await expect(resolveBotIdentity('12345', database as never)).resolves.toMatchObject({
      companyId: 'company-1',
      clientId: 'client-1',
    });
    expect(database.telegramIdentity.findMany).toHaveBeenCalledWith(
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

  it('returns deposit balances and immutable history only for the linked client', async () => {
    const database = {
      rental: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'rental-1',
            contractNumber: 'ME-1',
            status: 'COMPLETED',
            endsAt: new Date('2026-10-01T12:00:00Z'),
            completedAt: new Date('2026-10-02T12:00:00Z'),
            depositMinor: 1_000_000n,
            currency: 'RUB',
            vehicle: { make: 'Kia', modelName: 'K5', model: 'K5', registrationNumber: 'А001АА777' },
            depositLedgerEntries: [
              {
                id: 'entry-1',
                kind: 'DEPOSIT_PAYMENT',
                reason: 'Залог внесён',
                cashDeltaMinor: 1_000_000n,
                reservedDeltaMinor: 0n,
                withheldDeltaMinor: 0n,
                debtDeltaMinor: 0n,
                occurredAt: new Date('2026-10-01T12:00:00Z'),
              },
              {
                id: 'entry-2',
                kind: 'FINE_RESERVATION',
                reason: 'Штраф',
                cashDeltaMinor: 0n,
                reservedDeltaMinor: 115_000n,
                withheldDeltaMinor: 0n,
                debtDeltaMinor: 0n,
                occurredAt: new Date('2026-10-03T12:00:00Z'),
              },
            ],
          },
        ]),
      },
    };
    const result = await listClientDepositBalances(
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
    expect(database.rental.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1', clientId: 'client-1' } }),
    );
    expect(result[0]).toMatchObject({
      rentalId: 'rental-1',
      cashMinor: '1000000',
      reservedMinor: '115000',
      availableMinor: '885000',
      debtMinor: '0',
      returnDueOn: '2026-11-02',
    });
    expect(result[0]?.history).toHaveLength(2);
  });
});
