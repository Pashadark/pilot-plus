import { beforeEach, describe, expect, it, vi } from 'vitest';

const detectorMocks = vi.hoisted(() => ({
  acceleration: vi.fn().mockResolvedValue({ createdEventIds: [] }),
  braking: vi.fn().mockResolvedValue({ createdEventIds: [] }),
}));

vi.mock('./harsh-acceleration-events.server', () => ({
  detectAndPersistHarshAcceleration: detectorMocks.acceleration,
}));
vi.mock('./harsh-braking-events.server', () => ({
  detectAndPersistHarshBraking: detectorMocks.braking,
}));

vi.mock('@/modules/regional-geofences/server/evaluate-position', () => ({
  evaluateRegionalGeofencePosition: vi.fn().mockResolvedValue(null),
}));

import { syncCompanyLatestPositions } from './sync-company.server';

describe('дозагрузка точек движения GLONASSSoft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('дозагружает пропущенные терминальные точки и проверяет события во всём новом окне', async () => {
    const previousAt = new Date('2026-11-10T09:00:00.000Z');
    const latestAt = new Date('2026-11-10T09:00:30.000Z');
    const createMany = vi.fn().mockImplementation(async ({ data }) => ({
      count: Array.isArray(data) ? data.length : 0,
    }));
    const transaction = {
      vehiclePosition: {
        createMany,
        findFirst: vi.fn().mockResolvedValue({
          id: 'position-previous',
          latitude: 55.75,
          longitude: 37.61,
          speedKph: 0,
          recordedAt: previousAt,
        }),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'position-previous' },
            { id: 'position-history-1' },
            { id: 'position-history-2' },
            { id: 'position-history-3' },
            { id: 'position-latest' },
          ]),
      },
      companyGpsSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      vehicleGpsSettingsOverride: { findUnique: vi.fn().mockResolvedValue(null) },
      vehicle: {
        findFirst: vi.fn().mockResolvedValue({ engineHours: 100 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rental: { findFirst: vi.fn().mockResolvedValue(null) },
      vehicleEvent: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const prisma = {
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
      vehiclePosition: {
        findMany: vi.fn().mockResolvedValue([{ vehicleId: 'vehicle-1', recordedAt: previousAt }]),
      },
      $transaction: vi.fn((callback) => callback(transaction)),
    };
    const getTerminalMessages = vi.fn().mockResolvedValue([
      {
        externalId: 'message-1',
        recordedAt: '2026-11-10T09:00:10.000Z',
        latitude: 55.7501,
        longitude: 37.6101,
        speedKph: 0,
        odometerKm: 50_000,
      },
      {
        externalId: 'message-2',
        recordedAt: '2026-11-10T09:00:13.000Z',
        latitude: 55.7502,
        longitude: 37.6102,
        speedKph: 48,
        odometerKm: 50_000.1,
      },
      {
        externalId: 'latest-duplicate',
        recordedAt: latestAt.toISOString(),
        latitude: 55.7503,
        longitude: 37.6103,
        speedKph: 52,
        odometerKm: 50_000.2,
      },
    ]);

    await syncCompanyLatestPositions('company-a', {
      prisma,
      createClient: vi.fn(() => ({
        getLastData: vi.fn().mockResolvedValue([
          {
            externalId: '42',
            receivedAt: '2026-11-10T09:00:31.000Z',
            recordedAt: latestAt.toISOString(),
            state: 4,
            latitude: 55.7503,
            longitude: 37.6103,
            speedKph: 52,
            odometerKm: 50_000.2,
            fuelPercent: 50,
            address: null,
          },
        ]),
        getTerminalMessages,
      })),
      decrypt: vi.fn((value: string) => value),
      now: () => new Date('2026-11-10T09:00:32.000Z'),
    });

    expect(getTerminalMessages).toHaveBeenCalledWith({
      externalId: '42',
      from: previousAt,
      to: new Date('2026-11-10T09:00:30.001Z'),
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          vehicleId: 'vehicle-1',
          externalId: 'message-1',
          recordedAt: new Date('2026-11-10T09:00:10.000Z'),
          speedKph: 0,
        }),
        expect.objectContaining({
          vehicleId: 'vehicle-1',
          externalId: 'message-2',
          recordedAt: new Date('2026-11-10T09:00:13.000Z'),
          speedKph: 48,
        }),
      ],
      skipDuplicates: true,
    });
    expect(detectorMocks.acceleration).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-a',
        vehicleId: 'vehicle-1',
        endPositionIds: [
          'position-previous',
          'position-history-1',
          'position-history-2',
          'position-history-3',
          'position-latest',
        ],
      }),
    );
    expect(detectorMocks.braking).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-a',
        vehicleId: 'vehicle-1',
        endPositionIds: expect.arrayContaining(['position-history-2', 'position-latest']),
      }),
    );
  });
});
