import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  evaluateRegionalGeofencePosition,
  isReliableRegionalGeofencePosition,
} from './evaluate-position';

describe('regional geofence GPS quality guard', () => {
  const recordedAt = new Date('2026-11-10T09:00:00.000Z');

  it('rejects a GPS point delivered more than 15 minutes late', () => {
    expect(
      isReliableRegionalGeofencePosition(
        {
          latitude: 55.75,
          longitude: 37.61,
          speedKph: 0,
          recordedAt,
          receivedAt: new Date('2026-11-10T09:16:00.000Z'),
        },
        null,
      ),
    ).toBe(false);
  });

  it('rejects an implausible coordinate jump', () => {
    expect(
      isReliableRegionalGeofencePosition(
        {
          latitude: 59.93,
          longitude: 30.31,
          speedKph: 90,
          recordedAt: new Date('2026-11-10T09:01:00.000Z'),
          receivedAt: new Date('2026-11-10T09:01:02.000Z'),
        },
        {
          latitude: 55.75,
          longitude: 37.61,
          recordedAt,
        },
      ),
    ).toBe(false);
  });

  it('returns the confirmed OUTSIDE event context for client notification', async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'geofence-1',
          companyId: 'company-1',
          rentalId: 'rental-1',
          clientId: 'client-1',
          contractNumber: 'ME-2026-1108-MO',
          version: 3,
          regionCodes: ['RU-MOS', 'RU-MOW'],
          warningDistanceKm: 10,
          attentionDistanceKm: 5,
          criticalDistanceKm: 1,
          hysteresisMeters: 150,
          confirmationPoints: 2,
          confirmationWindowSeconds: 10,
          state: 'OUTSIDE_PENDING',
          pendingTransition: 'OUTSIDE',
          pendingCount: 1,
          pendingSince: new Date('2026-11-10T08:59:49.000Z'),
          outsideSince: null,
          lastEvaluatedAt: new Date('2026-11-10T08:59:58.000Z'),
          lastDistanceKm: 0.2,
          lastApproachThresholdKm: null,
          inside: false,
          distanceKm: 0.3,
          currentRegion: 'Владимирская область',
          nearestAllowedRegion: 'Московская область',
          automaticEnforcementAllowed: true,
        },
      ]),
      $executeRaw: vi.fn().mockResolvedValue(1),
      vehicleEvent: { upsert: vi.fn().mockResolvedValue({ id: 'event-1' }) },
    };

    await expect(
      evaluateRegionalGeofencePosition(database, {
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        position: {
          latitude: 56.1,
          longitude: 39.1,
          speedKph: 60,
          recordedAt,
          receivedAt: new Date('2026-11-10T09:00:02.000Z'),
        },
        previous: null,
      }),
    ).resolves.toMatchObject({
      eventId: 'event-1',
      eventType: 'OUTSIDE',
      rentalId: 'rental-1',
      clientId: 'client-1',
      geofenceVersion: 3,
    });
  });
});
