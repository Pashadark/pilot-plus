import { describe, expect, it, vi } from 'vitest';

import { detectAndPersistHarshAcceleration } from './harsh-acceleration-events.server';

function position(id: string, second: number, speedKph: number) {
  return {
    id,
    recordedAt: new Date(Date.UTC(2026, 9, 25, 10, 0, second)),
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
          position('p3', 3, 37.8),
          position('p2', 2, 25.2),
          position('p1', 1, 12.6),
          position('p0', 0, 0),
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

describe('detectAndPersistHarshAcceleration', () => {
  it('сохраняет подтверждённое событие с арендой, клиентом и стабильным dedupe-id', async () => {
    const prisma = repository();

    const result = await detectAndPersistHarshAcceleration({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latestPositionId: 'p3',
      prisma,
    });

    expect(result.createdEventIds).toHaveLength(1);
    expect(prisma.rental.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          vehicleId: 'vehicle-1',
          status: { in: ['CONFIRMED', 'ACTIVE'] },
        }),
      }),
    );
    expect(prisma.vehicleEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicleId_provider_externalId: {
            vehicleId: 'vehicle-1',
            provider: 'SUPA_PRO_GPS',
            externalId: 'harsh-acceleration:p0',
          },
        },
        create: expect.objectContaining({
          companyId: 'company-1',
          rentalId: 'rental-1',
          clientId: 'client-1',
          type: 'HARSH_ACCELERATION',
          severity: 'WARNING',
          startSpeedKph: 0,
          endSpeedKph: 37.8,
          description: 'Скорость выросла с 0 до 38 км/ч за 3 сек.',
          trackPointIds: ['p0', 'p1', 'p2', 'p3'],
        }),
      }),
    );
  });

  it('не создаёт событие повторно с новым ключом, когда тот же разгон продолжается', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'event-1' });
    const prisma = repository({
      vehiclePosition: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            position('p4', 4, 50.4),
            position('p3', 3, 37.8),
            position('p2', 2, 25.2),
            position('p1', 1, 12.6),
            position('p0', 0, 0),
          ]),
      },
      vehicleEvent: { upsert },
    });

    await detectAndPersistHarshAcceleration({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latestPositionId: 'p4',
      prisma,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicleId_provider_externalId: {
            vehicleId: 'vehicle-1',
            provider: 'SUPA_PRO_GPS',
            externalId: 'harsh-acceleration:p0',
          },
        },
      }),
    );
  });

  it('сохраняет событие, завершившееся внутри дозагруженного окна до последней точки', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'event-1' });
    const prisma = repository({
      vehiclePosition: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            position('p4', 4, 37.8),
            position('p3', 3, 37.8),
            position('p2', 2, 25.2),
            position('p1', 1, 12.6),
            position('p0', 0, 0),
          ]),
      },
      vehicleEvent: { upsert },
    });

    await detectAndPersistHarshAcceleration({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      endPositionIds: ['p0', 'p1', 'p2', 'p3', 'p4'],
      prisma,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          externalId: 'harsh-acceleration:p0',
          endSpeedKph: 37.8,
          trackPointIds: ['p0', 'p1', 'p2', 'p3'],
        }),
      }),
    );
  });

  it('ничего не пишет, когда детектор отключён для автомобиля', async () => {
    const prisma = repository({
      vehicleGpsSettingsOverride: {
        findUnique: vi.fn().mockResolvedValue({ accelerationDetectionEnabled: false }),
      },
    });

    const result = await detectAndPersistHarshAcceleration({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latestPositionId: 'p3',
      prisma,
    });

    expect(result).toEqual({ createdEventIds: [] });
    expect(prisma.vehicleEvent.upsert).not.toHaveBeenCalled();
  });

  it('ставит уведомление сотрудникам в очередь только при включённом режиме', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = repository({
      companyGpsSettings: {
        findUnique: vi.fn().mockResolvedValue({ notificationMode: 'STAFF_ONLY' }),
      },
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100123' }),
      },
      botNotificationJob: { createMany },
    });

    await detectAndPersistHarshAcceleration({
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latestPositionId: 'p3',
      prisma,
    });

    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            companyId: 'company-1',
            eventKey: expect.stringContaining('gps-event:staff:'),
            template: 'OPERATIONAL_ALERT',
          }),
        ],
      }),
    );
  });
});
