import { describe, expect, it } from 'vitest';

import {
  SERVICE_DWELL_MS,
  SERVICE_MAX_POINT_GAP_MS,
  SERVICE_ZONE,
  distanceFromServiceMeters,
  nextServiceVisitState,
} from './service-zone';

const enteredAt = new Date('2026-11-07T08:00:00.000Z');

function insideAt(minutes: number, overrides: Record<string, unknown> = {}) {
  const recordedAt = new Date(enteredAt.getTime() + minutes * 60_000);
  return {
    latitude: SERVICE_ZONE.latitude,
    longitude: SERVICE_ZONE.longitude,
    recordedAt,
    observedAt: recordedAt,
    activeVisit: {
      enteredAt,
      lastInsideAt: new Date(recordedAt.getTime() - 60_000),
      confirmedAt: null,
    },
    ...overrides,
  };
}

describe('service geofence', () => {
  it('uses the approved center, radius, dwell and point gap', () => {
    expect(SERVICE_ZONE).toMatchObject({
      latitude: 55.616017,
      longitude: 37.716422,
      radiusMeters: 150,
    });
    expect(SERVICE_DWELL_MS).toBe(40 * 60_000);
    expect(SERVICE_MAX_POINT_GAP_MS).toBe(15 * 60_000);
  });

  it('calculates distance from the service center', () => {
    expect(distanceFromServiceMeters(SERVICE_ZONE.latitude, SERVICE_ZONE.longitude)).toBe(0);
    expect(distanceFromServiceMeters(55.62, 37.72)).toBeGreaterThan(150);
  });

  it('opens a visit on the first fresh point inside the zone', () => {
    expect(nextServiceVisitState({ ...insideAt(0), activeVisit: null })).toEqual({
      type: 'ENTER',
    });
  });

  it('does not confirm a stay before forty minutes', () => {
    expect(nextServiceVisitState(insideAt(39))).toEqual({ type: 'CONTINUE' });
  });

  it('confirms a continuous forty minute stay once', () => {
    expect(nextServiceVisitState(insideAt(40))).toEqual({ type: 'CONFIRM' });
    expect(
      nextServiceVisitState(
        insideAt(41, {
          activeVisit: {
            enteredAt,
            lastInsideAt: new Date('2026-11-07T08:40:00.000Z'),
            confirmedAt: new Date('2026-11-07T08:40:00.000Z'),
          },
        }),
      ),
    ).toEqual({ type: 'CONTINUE' });
  });

  it('restarts dwell after a gap longer than fifteen minutes', () => {
    expect(
      nextServiceVisitState(
        insideAt(40, {
          activeVisit: {
            enteredAt,
            lastInsideAt: new Date('2026-11-07T08:20:00.000Z'),
            confirmedAt: null,
          },
        }),
      ),
    ).toEqual({ type: 'RESET' });
  });

  it('closes an active visit on a fresh point outside the zone', () => {
    expect(
      nextServiceVisitState({
        ...insideAt(10),
        latitude: 55.62,
        longitude: 37.72,
      }),
    ).toEqual({ type: 'EXIT' });
  });

  it('ignores stale points and never confirms from them', () => {
    const recordedAt = new Date('2026-11-07T08:40:00.000Z');
    expect(
      nextServiceVisitState({
        ...insideAt(40),
        recordedAt,
        observedAt: new Date(recordedAt.getTime() + SERVICE_MAX_POINT_GAP_MS + 1),
      }),
    ).toEqual({ type: 'IGNORE' });
  });
});
