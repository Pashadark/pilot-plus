import { describe, expect, it } from 'vitest';

import { evaluateRegionalGeofenceTransition, type RegionalGeofenceSnapshot } from './state-machine';

const config = {
  thresholdsKm: [10, 5, 1],
  hysteresisMeters: 150,
  confirmationPoints: 3,
  confirmationWindowSeconds: 10,
};
const initial: RegionalGeofenceSnapshot = {
  state: 'INSIDE',
  pendingTransition: null,
  pendingCount: 0,
  pendingSince: null,
  outsideSince: null,
  lastDistanceKm: 12,
  lastApproachThresholdKm: null,
};

function observe(
  snapshot: RegionalGeofenceSnapshot,
  input: Partial<Parameters<typeof evaluateRegionalGeofenceTransition>[1]> = {},
) {
  return evaluateRegionalGeofenceTransition(
    snapshot,
    {
      inside: true,
      boundaryDistanceKm: 8,
      recordedAt: new Date('2026-11-10T09:00:00.000Z'),
      reliable: true,
      movingTowardBoundary: true,
      automaticEnforcementAllowed: true,
      ...input,
    },
    config,
  );
}

describe('regional geofence state machine', () => {
  it('emits configured approach thresholds once while moving toward the outer boundary', () => {
    const early = observe(initial);
    expect(early).toMatchObject({
      state: 'APPROACHING',
      event: 'APPROACHING',
      eventThresholdKm: 10,
    });
    const attention = observe(early, { boundaryDistanceKm: 4 });
    expect(attention).toMatchObject({ event: 'APPROACHING', eventThresholdKm: 5 });
    const repeated = observe(attention, { boundaryDistanceKm: 3 });
    expect(repeated.event).toBeNull();
  });

  it('does not classify a single GPS jump as an exit', () => {
    const pending = observe(initial, {
      inside: false,
      boundaryDistanceKm: 0.5,
      recordedAt: new Date('2026-11-10T09:00:00.000Z'),
    });
    expect(pending).toMatchObject({ state: 'OUTSIDE_PENDING', pendingCount: 1, event: null });
  });

  it('confirms exit only after several measurements across the debounce window', () => {
    const one = observe(initial, {
      inside: false,
      boundaryDistanceKm: 0.5,
      recordedAt: new Date('2026-11-10T09:00:00.000Z'),
    });
    const two = observe(one, {
      inside: false,
      boundaryDistanceKm: 0.7,
      recordedAt: new Date('2026-11-10T09:00:05.000Z'),
    });
    const three = observe(two, {
      inside: false,
      boundaryDistanceKm: 1,
      recordedAt: new Date('2026-11-10T09:00:11.000Z'),
    });
    expect(three).toMatchObject({ state: 'OUTSIDE', event: 'OUTSIDE', pendingCount: 0 });
  });

  it('does not automatically enforce a disputed boundary', () => {
    const result = observe(initial, {
      inside: false,
      boundaryDistanceKm: 2,
      automaticEnforcementAllowed: false,
    });
    expect(result).toEqual(expect.objectContaining({ state: 'INSIDE', event: null }));
  });

  it('emits one return event after confirmed movement back inside', () => {
    const outside: RegionalGeofenceSnapshot = {
      ...initial,
      state: 'OUTSIDE',
      outsideSince: new Date('2026-11-10T08:00:00.000Z'),
    };
    const one = observe(outside, {
      boundaryDistanceKm: 0.5,
      recordedAt: new Date('2026-11-10T09:00:00.000Z'),
    });
    const two = observe(one, {
      boundaryDistanceKm: 0.7,
      recordedAt: new Date('2026-11-10T09:00:05.000Z'),
    });
    const three = observe(two, {
      boundaryDistanceKm: 1,
      recordedAt: new Date('2026-11-10T09:00:11.000Z'),
    });
    expect(three).toMatchObject({ state: 'RETURNED', event: 'RETURNED' });
  });
});
