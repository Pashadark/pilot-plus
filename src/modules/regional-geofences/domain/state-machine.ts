export type RegionalGeofenceState =
  'INSIDE' | 'APPROACHING' | 'OUTSIDE_PENDING' | 'OUTSIDE' | 'RETURNED';

export type RegionalGeofenceEvent = 'APPROACHING' | 'OUTSIDE' | 'RETURNED';

export interface RegionalGeofenceSnapshot {
  state: RegionalGeofenceState;
  pendingTransition: 'OUTSIDE' | 'INSIDE' | null;
  pendingCount: number;
  pendingSince: Date | null;
  outsideSince: Date | null;
  lastDistanceKm: number | null;
  lastApproachThresholdKm: number | null;
}

export interface RegionalGeofenceObservation {
  inside: boolean;
  boundaryDistanceKm: number;
  recordedAt: Date;
  reliable: boolean;
  movingTowardBoundary: boolean;
  automaticEnforcementAllowed: boolean;
}

export interface RegionalGeofenceConfig {
  thresholdsKm: readonly number[];
  hysteresisMeters: number;
  confirmationPoints: number;
  confirmationWindowSeconds: number;
}

export interface RegionalGeofenceTransition extends RegionalGeofenceSnapshot {
  event: RegionalGeofenceEvent | null;
  eventThresholdKm: number | null;
}

function resetPending(snapshot: RegionalGeofenceSnapshot) {
  return { ...snapshot, pendingTransition: null, pendingCount: 0, pendingSince: null };
}

function confirmed(count: number, since: Date, now: Date, config: RegionalGeofenceConfig) {
  return (
    count >= config.confirmationPoints &&
    now.getTime() - since.getTime() >= config.confirmationWindowSeconds * 1000
  );
}

export function evaluateRegionalGeofenceTransition(
  snapshot: RegionalGeofenceSnapshot,
  observation: RegionalGeofenceObservation,
  config: RegionalGeofenceConfig,
): RegionalGeofenceTransition {
  const base = {
    ...snapshot,
    event: null,
    eventThresholdKm: null,
  } satisfies RegionalGeofenceTransition;
  if (
    !observation.reliable ||
    !Number.isFinite(observation.boundaryDistanceKm) ||
    observation.boundaryDistanceKm < 0
  ) {
    return base;
  }

  const bufferKm = config.hysteresisMeters / 1000;
  const thresholds = [...config.thresholdsKm]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left);
  const maximumThreshold = thresholds[0] ?? 0;

  if (!observation.inside) {
    if (!observation.automaticEnforcementAllowed) return base;
    if (snapshot.state === 'OUTSIDE') {
      return { ...resetPending(snapshot), state: 'OUTSIDE', event: null, eventThresholdKm: null };
    }
    if (observation.boundaryDistanceKm <= bufferKm) return base;

    const since =
      snapshot.pendingTransition === 'OUTSIDE' && snapshot.pendingSince
        ? snapshot.pendingSince
        : observation.recordedAt;
    const count = snapshot.pendingTransition === 'OUTSIDE' ? snapshot.pendingCount + 1 : 1;
    if (confirmed(count, since, observation.recordedAt, config)) {
      return {
        ...snapshot,
        state: 'OUTSIDE',
        pendingTransition: null,
        pendingCount: 0,
        pendingSince: null,
        outsideSince: since,
        lastDistanceKm: observation.boundaryDistanceKm,
        lastApproachThresholdKm: snapshot.lastApproachThresholdKm,
        event: 'OUTSIDE',
        eventThresholdKm: null,
      };
    }
    return {
      ...snapshot,
      state: 'OUTSIDE_PENDING',
      pendingTransition: 'OUTSIDE',
      pendingCount: count,
      pendingSince: since,
      lastDistanceKm: observation.boundaryDistanceKm,
      event: null,
      eventThresholdKm: null,
    };
  }

  if (snapshot.state === 'OUTSIDE' || snapshot.pendingTransition === 'INSIDE') {
    if (observation.boundaryDistanceKm <= bufferKm) return base;
    const since =
      snapshot.pendingTransition === 'INSIDE' && snapshot.pendingSince
        ? snapshot.pendingSince
        : observation.recordedAt;
    const count = snapshot.pendingTransition === 'INSIDE' ? snapshot.pendingCount + 1 : 1;
    if (confirmed(count, since, observation.recordedAt, config)) {
      return {
        ...snapshot,
        state: 'RETURNED',
        pendingTransition: null,
        pendingCount: 0,
        pendingSince: null,
        lastDistanceKm: observation.boundaryDistanceKm,
        lastApproachThresholdKm: thresholds.at(-1) ?? null,
        event: 'RETURNED',
        eventThresholdKm: null,
      };
    }
    return {
      ...snapshot,
      state: 'OUTSIDE',
      pendingTransition: 'INSIDE',
      pendingCount: count,
      pendingSince: since,
      lastDistanceKm: observation.boundaryDistanceKm,
      event: null,
      eventThresholdKm: null,
    };
  }

  const cleared = resetPending(snapshot);
  const resetThreshold =
    observation.boundaryDistanceKm > maximumThreshold + 2 ? null : snapshot.lastApproachThresholdKm;
  const crossedThresholds = thresholds.filter(
    (threshold) =>
      observation.boundaryDistanceKm <= threshold &&
      (resetThreshold === null || threshold < resetThreshold),
  );
  const crossedThreshold = crossedThresholds.at(-1) ?? null;
  const approaching = maximumThreshold > 0 && observation.boundaryDistanceKm <= maximumThreshold;

  return {
    ...cleared,
    state: approaching ? 'APPROACHING' : 'INSIDE',
    outsideSince: snapshot.state === 'RETURNED' ? null : snapshot.outsideSince,
    lastDistanceKm: observation.boundaryDistanceKm,
    lastApproachThresholdKm:
      crossedThreshold !== null && observation.movingTowardBoundary
        ? crossedThreshold
        : resetThreshold,
    event: crossedThreshold !== null && observation.movingTowardBoundary ? 'APPROACHING' : null,
    eventThresholdKm:
      crossedThreshold !== null && observation.movingTowardBoundary ? crossedThreshold : null,
  };
}
