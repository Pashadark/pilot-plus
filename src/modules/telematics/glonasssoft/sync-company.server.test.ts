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
    vehiclePosition: { upsert: vi.fn().mockResolvedValue({ id: 'position-1' }) },
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: vi.fn((callback) =>
      callback({
        vehiclePosition: { upsert: vi.fn().mockResolvedValue({ id: 'position-1' }) },
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
      vehiclePosition: { upsert: vi.fn().mockResolvedValue({ id: 'position-1' }) },
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
    ).resolves.toEqual({ requested: 1, saved: 1, skipped: 1 });

    expect(getLastData).toHaveBeenCalledWith(['42']);
    expect(transaction.vehiclePosition.upsert).toHaveBeenCalledWith({
      where: {
        vehicleId_provider_externalId: {
          vehicleId: 'vehicle-1',
          provider: 'GLONASSSOFT',
          externalId: '42:2026-08-20T09:00:00.000Z',
        },
      },
      create: expect.objectContaining({
        vehicleId: 'vehicle-1',
        latitude: 55.7558,
        longitude: 37.6176,
        provider: 'GLONASSSOFT',
        address: 'г. Москва, Зелёный проспект, д. 22',
      }),
      update: {},
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
    expect(prisma.vehiclePosition.upsert).not.toHaveBeenCalled();
  });
});
