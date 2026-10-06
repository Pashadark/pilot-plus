import { describe, expect, it, vi } from 'vitest';

import { encryptField } from '@/services/security/field-encryption';

import {
  ackNotificationJob,
  claimNotificationJobs,
  enqueueDailyOperationsDigests,
  enqueueOperationalAlerts,
  enqueueReturnReminders,
} from './notifications';

describe('bot notification leases', () => {
  it('enqueues separate idempotent daily operations and unpaid-fines messages at 08:00 Moscow', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
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
      enqueueDailyOperationsDigests(new Date('2026-08-20T05:05:00Z'), database as never),
    ).resolves.toBe(2);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            eventKey: 'daily-operations:company-1:2026-08-20:group',
            chatId: '-100777',
            template: 'DAILY_OPERATIONS_DIGEST',
          }),
          expect.objectContaining({
            eventKey: 'daily-unpaid-fines:company-1:2026-08-20:group',
            chatId: '-100777',
            template: 'DAILY_UNPAID_FINES',
          }),
        ]),
      }),
    );
  });

  it('does not enqueue the daily digest outside the 08:00 Moscow window', async () => {
    const database = {
      telegramGroupBinding: { findMany: vi.fn() },
      telegramIdentity: { findMany: vi.fn() },
      botNotificationJob: { createMany: vi.fn() },
    };

    await expect(
      enqueueDailyOperationsDigests(new Date('2026-08-20T04:59:00Z'), database as never),
    ).resolves.toBe(0);
    expect(database.telegramGroupBinding.findMany).not.toHaveBeenCalled();
  });

  it('adds idempotent Friday lease-to-own reminders only for the working group', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 5 });
    const database = {
      telegramGroupBinding: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { companyId: 'company-1', telegramChatId: '-100777', boundByUserId: 'user-1' },
          ]),
      },
      telegramIdentity: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'identity-1', companyId: 'company-1', userId: 'user-1' }]),
      },
      rental: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'rental-1',
            companyId: 'company-1',
            contractNumber: 'ME-2026-0030-GA',
            client: { firstName: 'Вадим', middleName: 'Алексеевич', lastName: 'Седов' },
            vehicle: { make: 'Kia', modelName: 'K5', model: 'K5', registrationNumber: 'В342НР797' },
            operations: [],
          },
        ]),
      },
      botNotificationJob: { createMany },
    };

    await enqueueDailyOperationsDigests(new Date('2026-09-18T05:05:00.000Z'), database as never);

    const rows = createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows).toContainEqual(
      expect.objectContaining({
        chatId: '-100777',
        template: 'LEASE_TO_OWN_WEEKLY_INSPECTION',
        eventKey: 'lease-to-own-inspection:company-1:rental-1:2026-09-14:group',
      }),
    );
    expect(
      rows.some((row) => row.template === 'LEASE_TO_OWN_WEEKLY_INSPECTION' && 'identityId' in row),
    ).toBe(false);
  });

  it('enqueues independent nightly jobs for the group and the binding staff identity', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 4 });
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
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'identity-1', companyId: 'company-1', userId: 'user-1' }]),
      },
      botNotificationJob: { createMany },
    };

    await expect(
      enqueueDailyOperationsDigests(new Date('2026-08-20T05:05:00Z'), database as never),
    ).resolves.toBe(4);

    expect(createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          eventKey: 'daily-operations:company-1:2026-08-20:group',
          chatId: '-100777',
        }),
        expect.objectContaining({
          eventKey: 'daily-unpaid-fines:company-1:2026-08-20:group',
          chatId: '-100777',
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it('enqueues id-only GPS and return alerts for the group and responsible staff', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 4 });
    const database = {
      telegramGroupBinding: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { companyId: 'company-1', telegramChatId: '-100777', boundByUserId: 'user-1' },
          ]),
      },
      telegramIdentity: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'identity-1', companyId: 'company-1', userId: 'user-1' }]),
      },
      vehicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'vehicle-1',
            companyId: 'company-1',
            positions: [{ recordedAt: new Date('2026-09-07T02:00:00Z') }],
            rentals: [{ id: 'rental-1' }],
          },
        ]),
      },
      rental: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'rental-1',
            companyId: 'company-1',
            vehicleId: 'vehicle-1',
            endsAt: new Date('2026-09-07T11:00:00Z'),
          },
        ]),
      },
      vehicleEvent: { findMany: vi.fn().mockResolvedValue([]) },
      fine: { findMany: vi.fn().mockResolvedValue([]) },
      botNotificationJob: { createMany },
    };

    await expect(
      enqueueOperationalAlerts(new Date('2026-09-07T09:00:00Z'), database as never),
    ).resolves.toBe(4);

    const rows = createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chatId: '-100777',
          template: 'OPERATIONAL_ALERT',
          payload: {
            kind: 'RENTED_GPS_WARNING',
            vehicleId: 'vehicle-1',
            rentalId: 'rental-1',
          },
        }),
        expect.objectContaining({
          chatId: '-100777',
          payload: {
            kind: 'RETURN_SOON',
            vehicleId: 'vehicle-1',
            rentalId: 'rental-1',
          },
        }),
      ]),
    );
    expect(JSON.stringify(rows)).not.toMatch(/registrationNumber|phone|firstName|lastName/iu);
  });

  it('does not scan operational sources outside the 15-minute collection window', async () => {
    const database = {
      telegramGroupBinding: { findMany: vi.fn() },
      telegramIdentity: { findMany: vi.fn() },
      vehicle: { findMany: vi.fn() },
      rental: { findMany: vi.fn() },
      vehicleEvent: { findMany: vi.fn() },
      fine: { findMany: vi.fn() },
      botNotificationJob: { createMany: vi.fn() },
    };

    await expect(
      enqueueOperationalAlerts(new Date('2026-09-07T09:01:00Z'), database as never),
    ).resolves.toBe(0);
    expect(database.telegramGroupBinding.findMany).not.toHaveBeenCalled();
  });

  it('enqueues one low-fuel alert per episode when the current level is 20 percent or less', async () => {
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
      vehicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'vehicle-1',
            companyId: 'company-1',
            positions: [
              {
                id: 'position-low',
                recordedAt: new Date('2026-09-07T08:59:00Z'),
                fuelLevelPercent: 20,
              },
            ],
            rentalOperations: [],
            rentals: [],
          },
        ]),
      },
      vehiclePosition: {
        findFirst: vi.fn().mockResolvedValue({ id: 'position-last-full' }),
      },
      rentalOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      rental: { findMany: vi.fn().mockResolvedValue([]) },
      vehicleEvent: { findMany: vi.fn().mockResolvedValue([]) },
      fine: { findMany: vi.fn().mockResolvedValue([]) },
      botNotificationJob: { createMany },
    };

    await expect(
      enqueueOperationalAlerts(new Date('2026-09-07T09:00:00Z'), database as never),
    ).resolves.toBe(1);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventKey: 'operational:fuel:vehicle-1:position:position-last-full:group:-100777',
          payload: {
            kind: 'LOW_FUEL',
            vehicleId: 'vehicle-1',
            fuelLevelPercent: 20,
          },
        }),
      ],
      skipDuplicates: true,
    });
  });
  it('returns only rows successfully claimed by this worker', async () => {
    const tx = {
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'job-1', claimToken: null },
          { id: 'job-2', claimToken: 'old' },
        ]),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'job-1',
          claimToken: 'worker:job-1',
          companyId: 'company-1',
          template: 'DEPOSIT_RETURNED',
          payload: {},
          identity: null,
          chatId: '-100777',
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
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob: {
        findMany: vi
          .fn()
          .mockResolvedValue([
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
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
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
          ])
          .mockResolvedValueOnce([]),
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
      lead: { findMany: vi.fn().mockResolvedValue([]) },
      fine: { findMany: vi.fn().mockResolvedValue([]) },
      fineIntegration: { findUnique: vi.fn().mockResolvedValue(null) },
      vehicleEvent: { count: vi.fn().mockResolvedValue(0) },
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
    expect((job.payload as { message: string }).message).not.toContain('Штрафы');
  });

  it('hydrates unpaid fines as a separate tenant-scoped daily message', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        decreeNumber: '18810550260831038048',
        offenseAt: new Date('2026-09-15T10:00:00.000Z'),
        discountExpiresAt: new Date('2026-09-25T20:59:59.000Z'),
        originalAmountMinor: BigInt(500_000),
        currentAmountMinor: BigInt(250_000),
        articleCode: '12.9 ч. 2',
        description: 'Превышение скорости',
        status: 'UNPAID',
        client: { lastName: 'Иванов' },
        vehicle: {
          make: 'Kia',
          modelName: 'Cerato',
          model: 'Cerato',
          registrationNumber: 'С886АУ997',
        },
      },
    ]);
    const tx = {
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'fine-daily-1', claimToken: null, leaseExpiresAt: null, status: 'PENDING' },
          ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'fine-daily-1',
          companyId: 'company-1',
          claimToken: 'worker:fine-daily-1',
          template: 'DAILY_UNPAID_FINES',
          payload: { date: '2026-09-16' },
          identity: null,
          chatId: '-100777',
        }),
      },
      fine: { findMany },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    const [job] = await claimNotificationJobs(
      new Date('2026-09-16T05:05:00.000Z'),
      'worker',
      database as never,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'company-1',
          status: { in: ['NEW', 'UNPAID', 'OVERDUE'] },
        },
      }),
    );
    expect(job.payload).toMatchObject({ parseMode: 'HTML' });
    expect((job.payload as { message: string }).message).toContain('Неоплаченные штрафы');
    expect((job.payload as { message: string }).message).toContain('<b>Иванов</b>');
    expect((job.payload as { message: string }).message).toContain(
      'Постановление № <code>18810550260831038048</code>',
    );
    expect((job.payload as { message: string }).message).toContain('Скидка до: <b>25.09.2026</b>');
  });

  it('hydrates a lead status job from tenant-scoped database rows', async () => {
    const encryptionKey = Buffer.alloc(32, 23).toString('base64');
    process.env.CLIENT_DATA_ENCRYPTION_KEY = encryptionKey;
    const tx = {
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'lead-job-1', claimToken: null, leaseExpiresAt: null, status: 'PENDING' },
          ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'lead-job-1',
          companyId: 'company-1',
          claimToken: 'worker:lead-job-1',
          template: 'LEAD_STATUS_CHANGED',
          payload: { leadId: 'lead-1', auditId: 'audit-1' },
          identity: null,
          chatId: '-100777',
        }),
      },
      lead: {
        findFirst: vi.fn().mockResolvedValue({
          name: 'Анна',
          lastName: 'Петрова',
          phoneEncrypted: encryptField('+7 999 123-45-67', encryptionKey),
          source: 'Авито',
          status: 'CONTACTED',
          nextContactAt: null,
          createdAt: new Date('2026-09-07T08:00:00.000Z'),
          assignedTo: { name: 'Павел Седов' },
        }),
      },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue({
          changes: { status: { from: 'NEW', to: 'CONTACTED' } },
          actorUser: { name: 'Оператор' },
        }),
      },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    const [job] = await claimNotificationJobs(
      new Date('2026-09-07T09:00:00.000Z'),
      'worker',
      database as never,
    );

    expect(tx.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lead-1', companyId: 'company-1' } }),
    );
    expect(tx.auditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'audit-1', companyId: 'company-1' } }),
    );
    expect(job.payload).toMatchObject({ parseMode: 'HTML' });
    expect((job.payload as { message: string }).message).toContain('Новая → Связались');
    expect((job.payload as { message: string }).message).toContain('+7 999 123-45-67');
  });

  it.each([
    ['HANDOVER', '🚗 <b>Аренда началась</b>', 'Пробег при выдаче: <b>85 000 км</b>'],
    ['RETURN', '🏁 <b>Аренда завершена</b>', 'Пробег за аренду: <b>746 км</b>'],
  ] as const)(
    'hydrates a %s lifecycle job with mileage and fuel readings',
    async (kind, title, mileageLine) => {
      const tx = {
        telegramGroupBinding: {
          findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
        },
        botNotificationJob: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: `lifecycle-${kind}`, claimToken: null, status: 'PENDING' }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            id: `lifecycle-${kind}`,
            companyId: 'company-1',
            claimToken: `worker:lifecycle-${kind}`,
            template: 'RENTAL_LIFECYCLE',
            payload: { kind, rentalId: 'rental-1', operationId: 'operation-1' },
            identity: null,
            chatId: '-100777',
          }),
        },
        rentalOperation: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({
              type: kind,
              occurredAt: new Date('2026-09-10T08:30:00.000Z'),
              mileageKm: kind === 'HANDOVER' ? 85_000 : 85_746,
              fuelLevelPercent: kind === 'HANDOVER' ? 80 : 55,
              actor: { name: 'Павел Седов' },
              rental: {
                contractNumber: 'ME-2026-0042-PS',
                client: {
                  firstName: 'Иван',
                  middleName: 'Иванович',
                  lastName: 'Иванов',
                },
                vehicle: {
                  make: 'Kia',
                  modelName: 'Cerato',
                  model: 'Cerato',
                  registrationNumber: 'С886АУ997',
                },
              },
            })
            .mockResolvedValueOnce({ mileageKm: 85_000, fuelLevelPercent: 80 }),
        },
      };
      const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

      const [job] = await claimNotificationJobs(
        new Date('2026-09-10T08:31:00.000Z'),
        'worker',
        database as never,
      );

      expect(job.payload).toMatchObject({ parseMode: 'HTML' });
      const message = (job.payload as { message: string }).message;
      expect(message).toContain(title);
      expect(message.replaceAll('\u00a0', ' ')).toContain(mileageLine);
      expect(message).toContain(
        kind === 'HANDOVER' ? 'Топливо при выдаче: <b>80%</b>' : 'Топливо: <b>80% → 55%</b>',
      );
      expect(message).toContain('Kia Cerato · <code>С886АУ997</code>');
      expect(message).toContain('Иванов Иван Иванович');
    },
  );

  it('hydrates an operational alert with vehicle, rental and client details', async () => {
    const encryptionKey = Buffer.alloc(32, 31).toString('base64');
    process.env.CLIENT_DATA_ENCRYPTION_KEY = encryptionKey;
    const tx = {
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'alert-1', claimToken: null, status: 'PENDING' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'alert-1',
          companyId: 'company-1',
          claimToken: 'worker:alert-1',
          template: 'OPERATIONAL_ALERT',
          payload: {
            kind: 'RETURN_OVERDUE',
            vehicleId: 'vehicle-1',
            rentalId: 'rental-1',
          },
          identity: null,
          chatId: '-100777',
        }),
      },
      vehicle: {
        findFirst: vi.fn().mockResolvedValue({
          make: 'Mercedes-Benz',
          modelName: 'E 220 d 4MATIC',
          model: 'E 220',
          registrationNumber: 'М283АМ997',
          positions: [{ recordedAt: new Date('2026-09-06T08:00:00Z') }],
        }),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          endsAt: new Date('2026-09-07T06:00:00Z'),
          client: {
            firstName: 'Иван',
            middleName: null,
            lastName: 'Петров',
            phoneEncrypted: encryptField('+7 900 000-00-00', encryptionKey),
          },
        }),
      },
      vehicleEvent: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    const [job] = await claimNotificationJobs(
      new Date('2026-09-07T09:00:00Z'),
      'worker',
      database as never,
    );

    expect(job.payload).toMatchObject({ parseMode: 'HTML' });
    expect((job.payload as { message: string }).message).toContain(
      'Возврат просрочен более чем на 2 часа',
    );
    expect((job.payload as { message: string }).message).toContain('Петров Иван');
    expect((job.payload as { message: string }).message).toContain('+7 900 000-00-00');
  });

  it('hydrates a new-fine alert with the full decree number', async () => {
    const tx = {
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'fine-alert-1', claimToken: null, status: 'PENDING' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'fine-alert-1',
          companyId: 'company-1',
          claimToken: 'worker:fine-alert-1',
          template: 'OPERATIONAL_ALERT',
          payload: { kind: 'NEW_FINE', vehicleId: 'vehicle-1', fineId: 'fine-1' },
          identity: null,
          chatId: '-100777',
        }),
      },
      vehicle: {
        findFirst: vi.fn().mockResolvedValue({
          make: 'Kia',
          modelName: 'Rio',
          model: 'Rio',
          registrationNumber: 'Р604АО997',
          positions: [],
        }),
      },
      rental: { findFirst: vi.fn().mockResolvedValue(null) },
      vehicleEvent: { findFirst: vi.fn().mockResolvedValue(null) },
      fine: {
        findFirst: vi.fn().mockResolvedValue({
          decreeNumber: '18810550260831038048',
          currentAmountMinor: BigInt(500000),
          articleCode: '8.14 ч.2',
          description: 'Неправильная парковка',
          offenseAt: new Date('2026-09-28T10:29:00Z'),
          clientId: null,
          client: null,
        }),
      },
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    const [job] = await claimNotificationJobs(
      new Date('2026-09-28T10:30:00Z'),
      'worker',
      database as never,
    );

    expect(tx.fine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ decreeNumber: true }),
      }),
    );
    expect((job.payload as { message: string }).message).toContain(
      'Постановление № <code>18810550260831038048</code>',
    );
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
