import { describe, expect, it, vi } from 'vitest';
import { enqueueReturnReminders, claimNotificationJobs } from './notifications';

describe('client return stages', () => {
  it.each(['disabled', 'changed', 'finished', 'wrong-client', 'old-stage'])(
    'suppresses %s notifications before delivery',
    async (reason) => {
      const now = new Date('2026-09-28T09:00:00Z');
      const endsAt = new Date('2026-09-28T09:25:00Z');
      const tx = {
        botNotificationJob: {
          findMany: vi.fn().mockResolvedValue([{ id: 'j1', status: 'PENDING', claimToken: null }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: 'j1',
              companyId: 'c1',
              claimToken: 'token',
              template: 'RENTAL_RETURN_CLIENT',
              chatId: null,
              payload: {
                rentalId: 'r1',
                stage: reason === 'old-stage' ? '24h' : '30m',
                endsAt: reason === 'changed' ? '2026-09-27T09:25:00.000Z' : endsAt.toISOString(),
              },
              identity: {
                telegramUserId: '123',
                isActive: reason !== 'disabled',
                clientId: reason === 'wrong-client' ? 'other' : 'cl1',
                companyId: 'c1',
                kind: 'CLIENT',
              },
            }),
        },
        rental: {
          findFirst: vi
            .fn()
            .mockResolvedValue(
              reason === 'finished' || reason === 'wrong-client'
                ? null
                : {
                    endsAt,
                    client: { firstName: 'Иван', middleName: null },
                    vehicle: {
                      make: 'Kia',
                      modelName: 'K5',
                      model: 'K5',
                      registrationNumber: 'А001АА777',
                    },
                  },
            ),
        },
      };
      const result = await claimNotificationJobs(now, 'worker', {
        $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx),
      } as never);
      expect(result).toEqual([]);
      expect(tx.botNotificationJob.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    },
  );
  it.each([
    [23 * 60, '24h'],
    [150, '3h'],
    [25, '30m'],
  ])('selects only the current stage at %i minutes', async (minutes, stage) => {
    const now = new Date('2026-09-28T09:00:00Z');
    const endsAt = new Date(now.getTime() + Number(minutes) * 60000);
    const database = {
      rental: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'r1',
              companyId: 'c1',
              clientId: 'cl1',
              endsAt,
              client: { telegramIdentity: { id: 'i1', isActive: true } },
            },
          ]),
      },
      botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    await enqueueReturnReminders(now, database as never);
    const rows = database.botNotificationJob.createMany.mock.calls[0][0].data;
    const client = rows.filter((row: { identityId?: string }) => row.identityId);
    expect(client).toHaveLength(1);
    expect(client[0].eventKey).toBe(`rental-return:r1:${endsAt.toISOString()}:${stage}:client`);
    expect(client[0].payload).toMatchObject({
      rentalId: 'r1',
      endsAt: endsAt.toISOString(),
      stage,
    });
  });
});
