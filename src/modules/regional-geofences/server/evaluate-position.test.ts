import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isReliableRegionalGeofencePosition } from './evaluate-position';

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
});
