import { describe, expect, it, vi } from 'vitest';

import { syncCompanyLatestPositions } from './sync-company.server';

function database() {
  return {
    telematicsIntegration: {
      findUnique: vi.fn().mockResolvedValue({
        companyId: 'company-a',
        baseUrl: 'https://gs.sputnik.vision/api/v3',
        usernameEncrypted: 'encrypted-user',
        passwordEncrypted: 'encrypted-password',
        enabled: true,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    telematicsVehicleLink: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { vehicleId: 'vehicle-1', externalId: '42', registrationNumberNormalized: 'А156АХ997' },
        ]),
    },
    vehiclePosition: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: vi.fn((callback) =>
      callback({
        vehiclePosition: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }),
    ),
  };
}

describe('синхронизация последних позиций GLONASSSoft', () => {
  it('останавливается до сети, если интеграция компании выключена', async () => {
    const prisma = database();
    prisma.telematicsIntegration.findUnique.mockResolvedValue(null);
    const createClient = vi.fn();

    await expect(
      syncCompanyLatestPositions('company-a', { prisma, createClient, decrypt: vi.fn() }),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(createClient).not.toHaveBeenCalled();
    expect(prisma.telematicsVehicleLink.findMany).not.toHaveBeenCalled();
  });

  it('сохраняет только связанные tenant-машины и обновляет более новый пробег', async () => {
    const prisma = database();
    const transaction = {
      vehiclePosition: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));
    const getLastData = vi.fn().mockResolvedValue([
      {
        externalId: '42',
        receivedAt: '2026-08-20T09:00:30Z',
        recordedAt: '2026-08-20T09:00:00Z',
        state: 4,
        latitude: 55.7558,
        longitude: 37.6176,
        speedKph: 32,
        odometerKm: 12345.6,
        fuelPercent: 67,
        address: 'г. Москва, Зелёный проспект, д. 22',
      },
      {
        externalId: 'foreign',
        receivedAt: '2026-08-20T09:00:30Z',
        recordedAt: '2026-08-20T09:00:00Z',
        state: 4,
        latitude: 1,
        longitude: 1,
        speedKph: 1,
        odometerKm: null,
        fuelPercent: null,
      },
    ]);

    await expect(
      syncCompanyLatestPositions('company-a', {
        prisma,
        createClient: vi.fn(() => ({ getLastData })),
        decrypt: vi.fn((value: string) => value),
        now: () => new Date('2026-08-20T09:01:00Z'),
      }),
    ).resolves.toEqual({
      requested: 1,
      saved: 1,
      skipped: 1,
      changedVehicleIds: ['vehicle-1'],
    });

    expect(getLastData).toHaveBeenCalledWith(['42']);
    expect(transaction.vehiclePosition.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          vehicleId: 'vehicle-1',
          latitude: 55.7558,
          longitude: 37.6176,
          provider: 'GLONASSSOFT',
          address: 'г. Москва, Зелёный проспект, д. 22',
        }),
      ],
      skipDuplicates: true,
    });
    expect(transaction.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'vehicle-1', companyId: 'company-a', archivedAt: null },
      data: { odometerKm: 12345.6, status: 'MOVING' },
    });
    expect(prisma.telematicsIntegration.updateMany).toHaveBeenLastCalledWith({
      where: { companyId: 'company-a', enabled: true },
      data: expect.objectContaining({
        lastSuccessAt: new Date('2026-08-20T09:01:00Z'),
        lastErrorCode: null,
      }),
    });
  });

  it('после сохранения точки запускает серверный детектор резкого разгона', async () => {
    const prisma = database();
    const findFirstPosition = vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'p3' });
    const upsertEvent = vi.fn().mockResolvedValue({ id: 'event-1' });
    const transaction = {
      companyGpsSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      vehicleGpsSettingsOverride: { findUnique: vi.fn().mockResolvedValue(null) },
      vehiclePosition: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: findFirstPosition,
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'p3',
            recordedAt: new Date('2026-10-25T10:00:03.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 37.8,
          },
          {
            id: 'p2',
            recordedAt: new Date('2026-10-25T10:00:02.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 25.2,
          },
          {
            id: 'p1',
            recordedAt: new Date('2026-10-25T10:00:01.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 12.6,
          },
          {
            id: 'p0',
            recordedAt: new Date('2026-10-25T10:00:00.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 0,
          },
        ]),
      },
      vehicle: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      rental: { findFirst: vi.fn().mockResolvedValue(null) },
      vehicleEvent: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: upsertEvent,
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));

    await syncCompanyLatestPositions('company-a', {
      prisma,
      createClient: vi.fn(() => ({
        getLastData: vi.fn().mockResolvedValue([
          {
            externalId: '42',
            receivedAt: '2026-10-25T10:00:03.500Z',
            recordedAt: '2026-10-25T10:00:03.000Z',
            state: 4,
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 37.8,
            odometerKm: null,
            fuelPercent: null,
            address: null,
          },
        ]),
      })),
      decrypt: vi.fn((value: string) => value),
      now: () => new Date('2026-10-25T10:00:04.000Z'),
    });

    expect(upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ type: 'HARSH_ACCELERATION' }) }),
    );
  });

  it('после сохранения точки запускает серверный детектор резкого торможения', async () => {
    const prisma = database();
    const findFirstPosition = vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'p3' });
    const upsertEvent = vi.fn().mockResolvedValue({ id: 'event-1' });
    const transaction = {
      companyGpsSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      vehicleGpsSettingsOverride: { findUnique: vi.fn().mockResolvedValue(null) },
      vehiclePosition: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: findFirstPosition,
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'p3',
            recordedAt: new Date('2026-10-27T10:00:03.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 0,
          },
          {
            id: 'p2',
            recordedAt: new Date('2026-10-27T10:00:02.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 12.6,
          },
          {
            id: 'p1',
            recordedAt: new Date('2026-10-27T10:00:01.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 25.2,
          },
          {
            id: 'p0',
            recordedAt: new Date('2026-10-27T10:00:00.000Z'),
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 37.8,
          },
        ]),
      },
      vehicle: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      rental: { findFirst: vi.fn().mockResolvedValue(null) },
      vehicleEvent: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: upsertEvent,
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));

    await syncCompanyLatestPositions('company-a', {
      prisma,
      createClient: vi.fn(() => ({
        getLastData: vi.fn().mockResolvedValue([
          {
            externalId: '42',
            receivedAt: '2026-10-27T10:00:03.500Z',
            recordedAt: '2026-10-27T10:00:03.000Z',
            state: 4,
            latitude: 55.75,
            longitude: 37.61,
            speedKph: 0,
            odometerKm: null,
            fuelPercent: null,
            address: null,
          },
        ]),
      })),
      decrypt: vi.fn((value: string) => value),
      now: () => new Date('2026-10-27T10:00:04.000Z'),
    });

    expect(upsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ type: 'HARSH_BRAKING' }) }),
    );
  });

  it('записывает безопасный код ошибки и не очищает последнюю позицию', async () => {
    const prisma = database();
    const error = Object.assign(new Error('provider-password'), { code: 'TIMEOUT' });

    await expect(
      syncCompanyLatestPositions('company-a', {
        prisma,
        createClient: vi.fn(() => ({ getLastData: vi.fn().mockRejectedValue(error) })),
        decrypt: vi.fn((value: string) => value),
      }),
    ).rejects.toBe(error);
    expect(prisma.telematicsIntegration.updateMany).toHaveBeenLastCalledWith({
      where: { companyId: 'company-a', enabled: true },
      data: expect.objectContaining({ lastErrorCode: 'TIMEOUT' }),
    });
    expect(prisma.vehiclePosition.createMany).not.toHaveBeenCalled();
  });

  async function syncSpeed(currentSpeedKph: number, previousSpeedKph: number | null) {
    const prisma = database();
    const vehicleEvent = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const transaction = {
      vehiclePosition: {
        findFirst: vi.fn().mockResolvedValue(
          previousSpeedKph === null
            ? null
            : {
                latitude: 55.74,
                longitude: 37.6,
                speedKph: previousSpeedKph,
                recordedAt: new Date('2026-08-20T08:59:00Z'),
              },
        ),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      vehicleEvent,
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));
    await syncCompanyLatestPositions('company-a', {
      prisma,
      createClient: vi.fn(() => ({
        getLastData: vi.fn().mockResolvedValue([
          {
            externalId: '42',
            receivedAt: '2026-08-20T09:00:30Z',
            recordedAt: '2026-08-20T09:00:00Z',
            state: 4,
            latitude: 55.75,
            longitude: 37.61,
            speedKph: currentSpeedKph,
            odometerKm: 1,
            fuelPercent: 50,
          },
        ]),
      })),
      decrypt: vi.fn((value: string) => value),
    });
    return vehicleEvent;
  }

  it('не создаёт предупреждение ниже 145 км/ч', async () => {
    expect((await syncSpeed(144, 120)).createMany).not.toHaveBeenCalled();
  });

  it('создаёт предупреждение при достижении 145 км/ч', async () => {
    const vehicleEvent = await syncSpeed(145, 144);
    expect(vehicleEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'SPEEDING',
          severity: 'DANGER',
          title: 'Скорость 145 км/ч',
          description: 'Зафиксирована скорость 145 км/ч или выше.',
          externalId: expect.stringContaining('speeding-145'),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('не пропускает первую позицию со скоростью 145 км/ч или выше', async () => {
    expect((await syncSpeed(151, null)).createMany).toHaveBeenCalledTimes(1);
  });

  it('не повторяет предупреждение при непрерывном превышении', async () => {
    expect((await syncSpeed(150, 145)).createMany).not.toHaveBeenCalled();
  });

  it('снова предупреждает после снижения скорости ниже порога', async () => {
    expect((await syncSpeed(146, 120)).createMany).toHaveBeenCalledTimes(1);
  });

  it('ставит одно уведомление после тридцати минут без движения внутри геозоны', async () => {
    const prisma = database();
    const botNotificationJob = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const transaction = {
      vehiclePosition: {
        findFirst: vi.fn().mockResolvedValue({
          latitude: 55.607911,
          longitude: 37.624418,
          speedKph: 0,
          recordedAt: new Date('2026-10-23T12:45:00Z'),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            latitude: 55.607911,
            longitude: 37.624418,
            speedKph: 0,
            recordedAt: new Date('2026-10-23T12:29:00Z'),
          },
          {
            latitude: 55.607912,
            longitude: 37.624419,
            speedKph: 1,
            recordedAt: new Date('2026-10-23T12:45:00Z'),
          },
          {
            latitude: 55.607911,
            longitude: 37.624418,
            speedKph: 0,
            recordedAt: new Date('2026-10-23T13:00:00Z'),
          },
        ]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: {
        findFirst: vi.fn().mockResolvedValue({
          engineHours: 100,
          make: 'Toyota',
          modelName: 'Camry',
          model: 'Camry',
          registrationNumber: 'У899АВ997',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rental: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rental-1',
          contractNumber: 'СП-100',
          client: { firstName: 'Михаил', middleName: 'Дмитриевич', lastName: 'Гончаров' },
        }),
      },
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob,
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));

    await syncCompanyLatestPositions('company-a', {
      prisma,
      createClient: vi.fn(() => ({
        getLastData: vi.fn().mockResolvedValue([
          {
            externalId: '42',
            receivedAt: '2026-10-23T13:00:01Z',
            recordedAt: '2026-10-23T13:00:00Z',
            state: 1,
            latitude: 55.607911,
            longitude: 37.624418,
            speedKph: 0,
            odometerKm: 50000,
            fuelPercent: 50,
          },
        ]),
      })),
      decrypt: vi.fn((value: string) => value),
    });

    expect(botNotificationJob.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          chatId: '-100777',
          template: 'OPERATIONAL_ALERT',
          eventKey: 'impound-entry:company-a:vehicle-1:moscow-podolskikh-kursantov-7a:2026-10-23',
          payload: expect.objectContaining({
            kind: 'IMPOUND_LOT_ENTRY',
            vehicleId: 'vehicle-1',
            rentalId: 'rental-1',
            impoundLotId: 'moscow-podolskikh-kursantov-7a',
          }),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('не ставит уведомление при быстром проезде мимо Каскадной штрафстоянки', async () => {
    const prisma = database();
    const botNotificationJob = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const transaction = {
      vehiclePosition: {
        findFirst: vi.fn().mockResolvedValue({
          latitude: 55.709053,
          longitude: 37.876682,
          speedKph: 41,
          recordedAt: new Date('2026-10-27T12:56:34Z'),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            latitude: 55.709053,
            longitude: 37.876682,
            speedKph: 41,
            recordedAt: new Date('2026-10-27T12:56:34Z'),
          },
          {
            latitude: 55.708477,
            longitude: 37.881697,
            speedKph: 62,
            recordedAt: new Date('2026-10-27T12:56:57Z'),
          },
        ]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vehicle: {
        findFirst: vi.fn().mockResolvedValue({
          engineHours: 100,
          make: 'Kia',
          modelName: 'Ceed',
          model: 'Ceed',
          registrationNumber: 'А429АУ997',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rental: { findFirst: vi.fn().mockResolvedValue(null) },
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100777' }),
      },
      botNotificationJob,
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));

    await syncCompanyLatestPositions('company-a', {
      prisma,
      createClient: vi.fn(() => ({
        getLastData: vi.fn().mockResolvedValue([
          {
            externalId: '42',
            receivedAt: '2026-10-27T12:56:58Z',
            recordedAt: '2026-10-27T12:56:57Z',
            state: 4,
            latitude: 55.708477,
            longitude: 37.881697,
            speedKph: 62,
            odometerKm: 50000,
            fuelPercent: 50,
            address: 'Косинское шоссе, Москва',
          },
        ]),
      })),
      decrypt: vi.fn((value: string) => value),
    });

    expect(botNotificationJob.createMany).not.toHaveBeenCalled();
  });

  it('не объявляет повторную provider-точку новым изменением', async () => {
    const prisma = database();
    const transaction = {
      vehiclePosition: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));

    await expect(
      syncCompanyLatestPositions('company-a', {
        prisma,
        createClient: vi.fn(() => ({
          getLastData: vi.fn().mockResolvedValue([
            {
              externalId: '42',
              receivedAt: '2026-08-20T09:00:30Z',
              recordedAt: '2026-08-20T09:00:00Z',
              state: 4,
              latitude: 55.7558,
              longitude: 37.6176,
              speedKph: 32,
              odometerKm: 12345.6,
              fuelPercent: 67,
            },
          ]),
        })),
        decrypt: vi.fn((value: string) => value),
      }),
    ).resolves.toMatchObject({ saved: 0, changedVehicleIds: [] });
    expect(transaction.vehicle.updateMany).not.toHaveBeenCalled();
  });
});
