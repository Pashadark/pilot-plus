import { describe, expect, it, vi } from 'vitest';

import {
  ackNotificationJob,
  claimNotificationJobs,
  enqueueDailyOperationsDigests,
  enqueueReturnReminders,
} from './notifications';

describe('bot notification leases', () => {
  it('enqueues one idempotent daily digest per bound company after 00:05 Moscow', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      telegramGroupBinding: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { companyId: 'company-1', telegramChatId: '-100777', boundByUserId: 'user-1' },
          ]),
      },
      telegramIdentity: { findMany: vi.fn().mockResolvedValue([]) },
      botNotificationJob: { createMany },
    };
    await expect(
      enqueueDailyOperationsDigests(new Date('2026-08-19T21:05:00Z'), database as never),
    ).resolves.toBe(1);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            eventKey: 'daily-operations:company-1:2026-08-20:group',
            chatId: '-100777',
            template: 'DAILY_OPERATIONS_DIGEST',
          }),
        ],
      }),
    );
  });

  it('enqueues independent nightly jobs for the group and the binding staff identity', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const database = {
      telegramGroupBinding: {
        findMany: vi.fn().mockResolvedValue([
          {
            companyId: 'company-1',
            telegramChatId: '-100777',
            boundByUserId: 'user-1',
          },
        ]),
      },
      telegramIdentity: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'identity-1', companyId: 'company-1', userId: 'user-1' },
        ]),
      },
      botNotificationJob: { createMany },
    };

    await expect(
      enqueueDailyOperationsDigests(new Date('2026-08-19T21:05:00Z'), database as never),
    ).resolves.toBe(2);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventKey: 'daily-operations:company-1:2026-08-20:group',
          chatId: '-100777',
        }),
        expect.objectContaining({
          eventKey: 'daily-operations:company-1:2026-08-20:staff:identity-1',
          identityId: 'identity-1',
        }),
      ],
      skipDuplicates: true,
    });
  });
  it('returns only rows successfully claimed by this worker', async () => {
    const tx = {
      botNotificationJob: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'job-1', claimToken: null },
          { id: 'job-2', claimToken: 'old' },
        ]),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'job-1',
          claimToken: 'worker:job-1',
          template: 'RETURN',
          payload: {},
          identity: { telegramUserId: '123' },
          chatId: null,
        }),
      },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const jobs = await claimNotificationJobs(
      new Date('2026-08-19T10:00:00Z'),
      'worker',
      database as never,
    );
    expect(jobs.map((job) => job.id)).toEqual(['job-1']);
  });

  it('hydrates the nightly job with safe HTML for rentals, deposits, service and stale GPS', async () => {
    const tx = {
      botNotificationJob: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'daily-1', claimToken: null, leaseExpiresAt: null, status: 'PENDING' },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'daily-1',
          companyId: 'company-1',
          claimToken: 'worker:daily-1',
          template: 'DAILY_OPERATIONS_DIGEST',
          payload: { date: '2026-08-27' },
          identity: null,
          chatId: '-100777',
        }),
      },
      botRentalRequest: { count: vi.fn().mockResolvedValue(1) },
      rental: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          {
            startsAt: new Date('2026-08-27T06:00:00Z'),
            endsAt: new Date('2026-08-27T17:30:00Z'),
            contractNumber: 'ME-2026-0020-KS',
            client: {
              firstName: 'Семен',
              middleName: 'Юрьевич',
              lastName: 'Клементьев',
              phoneEncrypted: 'encrypted',
            },
            vehicle: {
              make: 'Mercedes-Benz',
              modelName: 'E220d 4Matic',
              model: 'E220d',
              registrationNumber: 'М283АМ997',
            },
          },
        ]),
      },
      rentalOperation: {
        findMany: vi.fn().mockResolvedValue([
          {
            occurredAt: new Date('2026-08-27T18:00:00Z'),
            depositAmountMinor: BigInt(20_000_00),
            rental: {
              contractNumber: 'ME-2026-0020-KS',
              client: {
                firstName: 'Семен',
                middleName: 'Юрьевич',
                lastName: 'Клементьев',
                phoneEncrypted: 'encrypted',
              },
              vehicle: {
                make: 'Mercedes-Benz',
                modelName: 'E220d 4Matic',
                model: 'E220d',
                registrationNumber: 'М283АМ997',
              },
            },
          },
        ]),
      },
      maintenanceRecord: {
        findMany: vi.fn().mockResolvedValue([
          {
            scheduledAt: new Date('2026-08-27T07:00:00Z'),
            title: 'Замена масла',
            status: 'PLANNED',
            vehicle: {
              make: 'Kia',
              modelName: 'K5',
              model: 'K5',
              registrationNumber: 'В342НР797',
            },
          },
        ]),
      },
      washRecord: {
        findMany: vi.fn().mockResolvedValue([
          {
            scheduledAt: new Date('2026-08-27T08:00:00Z'),
            kind: 'COMPLEX',
            status: 'PLANNED',
            vehicle: {
              make: 'Kia',
              modelName: 'Rio',
              model: 'Rio',
              registrationNumber: 'Р604АО997',
            },
          },
        ]),
      },
      vehicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            status: 'AVAILABLE',
            isDemoImport: false,
            make: 'Toyota',
            modelName: 'Camry',
            model: 'Camry',
            registrationNumber: 'Н726АХ550',
            rentals: [],
            maintenanceRecords: [],
            positions: [{ recordedAt: new Date('2026-08-26T18:00:00Z') }],
          },
        ]),
      },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    const [job] = await claimNotificationJobs(
      new Date('2026-08-27T20:00:00Z'),
      'worker',
      database as never,
    );

    expect(job.payload).toMatchObject({ parseMode: 'HTML' });
    expect((job.payload as { message: string }).message).toContain(
      '<code>20:30</code>  <b>Принять возврат автомобиля</b>',
    );
    expect((job.payload as { message: string }).message).toContain('💰 <b>Возврат депозитов</b>');
    expect((job.payload as { message: string }).message).toContain('🧼 <b>Мойки</b>');
    expect((job.payload as { message: string }).message).toContain(
      '🔧 <b>Техническое обслуживание</b>',
    );
    expect((job.payload as { message: string }).message).toContain('📡 <b>Нет GPS-связи</b>');
  });

  it('acks only the exact live claim token', async () => {
    const database = {
      botNotificationJob: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    await expect(
      ackNotificationJob('job-1', 'wrong-token', database as never),
    ).rejects.toMatchObject({ code: 'CLAIM_LOST' });
  });

  it('enqueues one id-only reminder per target without storing client PII', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const database = {
      rental: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            companyId: 'c1',
            clientId: 'cl1',
            endsAt: new Date('2026-08-20T09:00:00Z'),
            client: { telegramIdentity: { id: 'i1', isActive: true } },
          },
        ]),
      },
      botNotificationJob: { createMany },
    };
    await enqueueReturnReminders(new Date('2026-08-19T10:00:00Z'), database as never);
    const rows = createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).toContain('"rentalId":"r1"');
    expect(JSON.stringify(rows)).not.toMatch(/phone|firstName|middleName/iu);
  });
});
