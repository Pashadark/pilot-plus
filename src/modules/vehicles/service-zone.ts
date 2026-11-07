export const SERVICE_ZONE = {
  name: 'Сервис СУПА ПРО',
  address: 'Каширское шоссе, 61 к3А',
  latitude: 55.616017,
  longitude: 37.716422,
  radiusMeters: 150,
} as const;

export const SERVICE_DWELL_MS = 40 * 60_000;
export const SERVICE_MAX_POINT_GAP_MS = 15 * 60_000;

export interface ServiceVisitSnapshot {
  enteredAt: Date;
  lastInsideAt: Date;
  confirmedAt: Date | null;
}

export interface ServicePositionInput {
  latitude: number;
  longitude: number;
  recordedAt: Date;
  observedAt: Date;
  activeVisit: ServiceVisitSnapshot | null;
}

export type ServiceVisitTransition =
  | { type: 'IGNORE' }
  | { type: 'ENTER' }
  | { type: 'CONTINUE' }
  | { type: 'CONFIRM' }
  | { type: 'RESET' }
  | { type: 'EXIT' };

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceFromServiceMeters(latitude: number, longitude: number) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(latitude - SERVICE_ZONE.latitude);
  const longitudeDelta = radians(longitude - SERVICE_ZONE.longitude);
  const firstLatitude = radians(SERVICE_ZONE.latitude);
  const secondLatitude = radians(latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function nextServiceVisitState(input: ServicePositionInput): ServiceVisitTransition {
  const recordedAtMs = input.recordedAt.getTime();
  const observedAtMs = input.observedAt.getTime();
  if (
    !Number.isFinite(recordedAtMs) ||
    !Number.isFinite(observedAtMs) ||
    recordedAtMs > observedAtMs + 60_000 ||
    observedAtMs - recordedAtMs > SERVICE_MAX_POINT_GAP_MS
  ) {
    return { type: 'IGNORE' };
  }

  const inside =
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude) &&
    distanceFromServiceMeters(input.latitude, input.longitude) <= SERVICE_ZONE.radiusMeters;
  if (!inside) return input.activeVisit ? { type: 'EXIT' } : { type: 'IGNORE' };
  if (!input.activeVisit) return { type: 'ENTER' };

  if (recordedAtMs - input.activeVisit.lastInsideAt.getTime() > SERVICE_MAX_POINT_GAP_MS) {
    return { type: 'RESET' };
  }
  if (input.activeVisit.confirmedAt) return { type: 'CONTINUE' };
  if (recordedAtMs - input.activeVisit.enteredAt.getTime() >= SERVICE_DWELL_MS) {
    return { type: 'CONFIRM' };
  }
  return { type: 'CONTINUE' };
}
