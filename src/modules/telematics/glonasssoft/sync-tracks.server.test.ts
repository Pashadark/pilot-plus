import { describe, expect, it, vi } from 'vitest';

import { syncVehicleTrack } from './sync-tracks.server';

function database() {
  const transaction = {
    vehiclePosition: { upsert: vi.fn().mockResolvedValue({ id: 'point' }) },
  };
  return {
    telematicsIntegration: {
      findUnique: vi.fn().mockResolvedValue({
        baseUrl: 'https://gs.sputnik.vision/api/v3',
        usernameEncrypted: 'user',
        passwordEncrypted: 'password',
        enabled: true,
      }),
    },
    telematicsVehicleLink: {
      findFirst: vi.fn().mockResolvedValue({ vehicleId: 'vehicle-1', externalId: '42' }),
    },
    $transaction: vi.fn((callback) => callback(transaction)),
    transaction,
  };
}

describe('синхронизация трека GLONASSSoft', () => {
  it('отвергает период больше семи дней до базы и сети', async () => {
    const prisma = database();
    const createClient = vi.fn();

    await expect(
      syncVehicleTrack(
        {
          companyId: 'company-a',
          vehicleId: 'vehicle-1',
          from: new Date('2026-08-01T00:00:00Z'),
          to: new Date('2026-08-09T00:00:00Z'),
        },
        { prisma, createClient, decrypt: vi.fn() },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RANGE' });
    expect(prisma.telematicsVehicleLink.findFirst).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('требует точную tenant-связь активной машины', async () => {
    const prisma = database();
    prisma.telematicsVehicleLink.findFirst.mockResolvedValue(null);

    await expect(
      syncVehicleTrack(
        {
          companyId: 'company-a',
          vehicleId: 'foreign-vehicle',
          from: new Date('2026-08-20T00:00:00Z'),
          to: new Date('2026-08-21T00:00:00Z'),
        },
        { prisma, createClient: vi.fn(), decrypt: vi.fn() },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('идемпотентно сохраняет точки провайдера', async () => {
    const prisma = database();
    const getTerminalMessages = vi.fn().mockResolvedValue([
      {
        externalId: 'message-1',
        recordedAt: '2026-08-20T09:00:00Z',
        latitude: 55.7558,
        longitude: 37.6176,
        speedKph: 30,
        odometerKm: 12345.6,
      },
    ]);

    await expect(
      syncVehicleTrack(
        {
          companyId: 'company-a',
          vehicleId: 'vehicle-1',
          from: new Date('2026-08-20T00:00:00Z'),
          to: new Date('2026-08-21T00:00:00Z'),
        },
        {
          prisma,
          createClient: vi.fn(() => ({ getTerminalMessages })),
          decrypt: vi.fn((value: string) => value),
          now: () => new Date('2026-08-21T00:01:00Z'),
        },
      ),
    ).resolves.toEqual({ saved: 1 });
    expect(getTerminalMessages).toHaveBeenCalledWith({
      externalId: '42',
      from: new Date('2026-08-20T00:00:00Z'),
      to: new Date('2026-08-21T00:00:00Z'),
    });
    expect(prisma.transaction.vehiclePosition.upsert).toHaveBeenCalledWith({
      where: {
        vehicleId_provider_externalId: {
          vehicleId: 'vehicle-1',
          provider: 'GLONASSSOFT',
          externalId: 'message-1',
        },
      },
      create: expect.objectContaining({
        vehicleId: 'vehicle-1',
        receivedAt: new Date('2026-08-21T00:01:00Z'),
      }),
      update: {},
    });
  });
});
