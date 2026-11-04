import { describe, expect, it, vi } from 'vitest';

import { detectAndPersistHarshBraking } from './harsh-braking-events.server';

function position(id: string, second: number, speedKph: number) {
  return {
    id,
    recordedAt: new Date(Date.UTC(2026, 9, 27, 10, 0, second)),
    latitude: 55.75,
    longitude: 37.61,
    speedKph,
  };
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    companyGpsSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    vehicleGpsSettingsOverride: { findUnique: vi.fn().mockResolvedValue(null) },
    vehiclePosition: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          position('p3', 3, 0),
          position('p2', 2, 12.6),
          position('p1', 1, 25.2),
          position('p0', 0, 37.8),
        ]),
    },
    rental: {
      findFirst: vi.fn().mockResolvedValue({ id: 'rental-1', clientId: 'client-1' }),
    },
    vehicleEvent: {
      upsert: vi
        .fn()
        .mockImplementation(async ({ create }) => ({ id: `event:${create.externalId}` })),
    },
    ...overrides,
  };
}

describe('detectAndPersistHarshBraking', () => {
  it('сохраняет резкое торможение с точными скоростями и привязкой к аренде', async () => {
    const prisma = repository();

    const result = await detectAndPersistHarshBraking({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latestPositionId: 'p3',
      prisma,
    });

    expect(result.createdEventIds).toHaveLength(1);
    expect(prisma.vehicleEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicleId_provider_externalId: {
            vehicleId: 'vehicle-1',
            provider: 'SUPA_PRO_GPS',
            externalId: 'harsh-braking:p0',
          },
        },
        create: expect.objectContaining({
          companyId: 'company-1',
          rentalId: 'rental-1',
          clientId: 'client-1',
          type: 'HARSH_BRAKING',
          severity: 'WARNING',
          startSpeedKph: 37.8,
          endSpeedKph: 0,
          maxAccelerationMps2: expect.any(Number),
          description: 'Скорость снизилась с 38 до 0 км/ч за 3 сек.',
          trackPointIds: ['p0', 'p1', 'p2', 'p3'],
        }),
      }),
    );
  });

  it('ничего не пишет, когда торможение отключено для автомобиля', async () => {
    const prisma = repository({
      vehicleGpsSettingsOverride: {
        findUnique: vi.fn().mockResolvedValue({ brakingDetectionEnabled: false }),
      },
    });

    const result = await detectAndPersistHarshBraking({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latestPositionId: 'p3',
      prisma,
    });

    expect(result).toEqual({ createdEventIds: [] });
    expect(prisma.vehicleEvent.upsert).not.toHaveBeenCalled();
  });

  it('ставит клиентское и служебное уведомления в очередь', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = repository({
      companyGpsSettings: {
        findUnique: vi.fn().mockResolvedValue({ notificationMode: 'STAFF_AND_CLIENT' }),
      },
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100123' }),
      },
      telegramIdentity: {
        findUnique: vi.fn().mockResolvedValue({ id: 'identity-1', isActive: true }),
      },
      botNotificationJob: { createMany },
    });

    await detectAndPersistHarshBraking({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latestPositionId: 'p3',
      prisma,
    });

    expect(createMany).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            eventKey: expect.stringContaining('gps-event:client:'),
            template: 'CLIENT_GPS_EVENT',
            payload: expect.objectContaining({ kind: 'HARSH_BRAKING' }),
          }),
        ],
      }),
    );
  });
});
