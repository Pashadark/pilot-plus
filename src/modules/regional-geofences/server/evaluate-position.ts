import 'server-only';

import { Prisma } from '@/database/generated/prisma';

import {
  evaluateRegionalGeofenceTransition,
  type RegionalGeofenceSnapshot,
} from '../domain/state-machine';

export interface RegionalGeofencePosition {
  latitude: number;
  longitude: number;
  speedKph: number;
  recordedAt: Date;
  receivedAt: Date;
}

export interface PreviousRegionalGeofencePosition {
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

export interface RegionalGeofenceDatabase {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
  vehicleEvent: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
}

type EvaluationRow = {
  id: string;
  companyId: string;
  rentalId: string;
  clientId: string;
  contractNumber: string | null;
  version: number;
  regionCodes: string[];
  warningDistanceKm: number;
  attentionDistanceKm: number;
  criticalDistanceKm: number;
  hysteresisMeters: number;
  confirmationPoints: number;
  confirmationWindowSeconds: number;
  state: RegionalGeofenceSnapshot['state'];
  pendingTransition: 'OUTSIDE' | 'INSIDE' | null;
  pendingCount: number;
  pendingSince: Date | null;
  outsideSince: Date | null;
  lastEvaluatedAt: Date | null;
  lastDistanceKm: unknown | null;
  lastApproachThresholdKm: number | null;
  inside: boolean;
  distanceKm: unknown;
  currentRegion: string | null;
  nearestAllowedRegion: string | null;
  automaticEnforcementAllowed: boolean;
};

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function haversineKm(left: PreviousRegionalGeofencePosition, right: RegionalGeofencePosition) {
  const radiusKm = 6371.0088;
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = radians(right.latitude - left.latitude);
  const deltaLongitude = radians(right.longitude - left.longitude);
  const startLatitude = radians(left.latitude);
  const endLatitude = radians(right.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isReliableRegionalGeofencePosition(
  position: RegionalGeofencePosition,
  previous: PreviousRegionalGeofencePosition | null,
) {
  const deliveryDelayMs = position.receivedAt.getTime() - position.recordedAt.getTime();
  if (deliveryDelayMs < -60_000 || deliveryDelayMs > 15 * 60_000) return false;
  if (!previous) return true;
  const elapsedHours = (position.recordedAt.getTime() - previous.recordedAt.getTime()) / 3_600_000;
  if (elapsedHours <= 0) return false;
  const maximumPlausibleDistanceKm = Math.max(2, elapsedHours * 250 + 1);
  return haversineKm(previous, position) <= maximumPlausibleDistanceKm;
}

function eventPresentation(
  event: 'APPROACHING' | 'OUTSIDE' | 'RETURNED',
  threshold: number | null,
) {
  if (event === 'APPROACHING') {
    return {
      type: 'REGIONAL_GEOFENCE_APPROACH',
      severity: threshold !== null && threshold <= 1 ? 'DANGER' : 'WARNING',
      title: 'Приближение к границе разрешённой территории',
    } as const;
  }
  if (event === 'OUTSIDE') {
    return {
      type: 'REGIONAL_GEOFENCE_OUTSIDE',
      severity: 'DANGER',
      title: 'Выезд за разрешённую территорию',
    } as const;
  }
  return {
    type: 'REGIONAL_GEOFENCE_RETURNED',
    severity: 'INFO',
    title: 'Возвращение в разрешённую территорию',
  } as const;
}

export async function evaluateRegionalGeofencePosition(
  database: RegionalGeofenceDatabase,
  input: {
    companyId: string;
    vehicleId: string;
    position: RegionalGeofencePosition;
    previous: PreviousRegionalGeofencePosition | null;
  },
) {
  const { position } = input;
  const rows = await database.$queryRaw<EvaluationRow[]>(Prisma.sql`
    WITH point AS (
      SELECT ST_SetSRID(ST_MakePoint(${position.longitude}, ${position.latitude}), 4326) AS geom
    )
    SELECT
      g."id", g."companyId", g."rentalId", r."clientId", r."contractNumber", g."version",
      g."regionCodes", g."warningDistanceKm", g."attentionDistanceKm",
      g."criticalDistanceKm", g."hysteresisMeters", g."confirmationPoints",
      g."confirmationWindowSeconds", g."state", g."pendingTransition", g."pendingCount",
      g."pendingSince", g."outsideSince", g."lastEvaluatedAt", g."lastDistanceKm",
      g."lastApproachThresholdKm",
      ST_Covers(g."regionUnion", point.geom) AS "inside",
      ST_Distance(ST_Boundary(g."regionUnion")::geography, point.geom::geography) / 1000.0 AS "distanceKm",
      current_region."nameRu" AS "currentRegion",
      nearest_allowed."nameRu" AS "nearestAllowedRegion",
      COALESCE(current_region."automaticEnforcementAllowed", false) AS "automaticEnforcementAllowed"
    FROM "RentalRegionalGeofence" g
    JOIN "Rental" r ON r."id" = g."rentalId" AND r."companyId" = g."companyId"
    CROSS JOIN point
    LEFT JOIN LATERAL (
      SELECT region."nameRu", region."automaticEnforcementAllowed"
      FROM "RussianRegion" region
      WHERE region."boundary" IS NOT NULL AND ST_Covers(region."boundary", point.geom)
      ORDER BY region."code" ASC
      LIMIT 1
    ) current_region ON true
    LEFT JOIN LATERAL (
      SELECT region."nameRu"
      FROM "RussianRegion" region
      WHERE region."code" = ANY(g."regionCodes") AND region."boundary" IS NOT NULL
      ORDER BY region."boundary" <-> point.geom
      LIMIT 1
    ) nearest_allowed ON true
    WHERE g."companyId" = ${input.companyId}
      AND r."vehicleId" = ${input.vehicleId}
      AND r."status" IN ('CONFIRMED', 'ACTIVE')
      AND r."startsAt" <= ${position.recordedAt}
      AND r."endsAt" >= ${position.recordedAt}
      AND g."enabled" = true
      AND g."regionUnion" IS NOT NULL
    ORDER BY r."startsAt" DESC, r."id" DESC
    LIMIT 1
  `);
  const row = rows[0];
  if (!row || (row.lastEvaluatedAt && row.lastEvaluatedAt >= position.recordedAt)) return null;
  const distanceKm = number(row.distanceKm);
  const lastDistanceKm = row.lastDistanceKm == null ? null : number(row.lastDistanceKm);
  const reliable = isReliableRegionalGeofencePosition(position, input.previous);
  const transition = evaluateRegionalGeofenceTransition(
    {
      state: row.state,
      pendingTransition: row.pendingTransition,
      pendingCount: row.pendingCount,
      pendingSince: row.pendingSince,
      outsideSince: row.outsideSince,
      lastDistanceKm,
      lastApproachThresholdKm: row.lastApproachThresholdKm,
    },
    {
      inside: row.inside,
      boundaryDistanceKm: distanceKm,
      recordedAt: position.recordedAt,
      reliable,
      movingTowardBoundary:
        position.speedKph > 1 && (lastDistanceKm === null || distanceKm < lastDistanceKm - 0.01),
      automaticEnforcementAllowed: row.automaticEnforcementAllowed,
    },
    {
      thresholdsKm: [row.warningDistanceKm, row.attentionDistanceKm, row.criticalDistanceKm],
      hysteresisMeters: row.hysteresisMeters,
      confirmationPoints: row.confirmationPoints,
      confirmationWindowSeconds: row.confirmationWindowSeconds,
    },
  );
  if (!reliable) return null;
  await database.$executeRaw(Prisma.sql`
    UPDATE "RentalRegionalGeofence" SET
      "state" = ${transition.state}::"RegionalGeofenceState",
      "pendingTransition" = ${transition.pendingTransition},
      "pendingCount" = ${transition.pendingCount},
      "pendingSince" = ${transition.pendingSince},
      "outsideSince" = ${transition.outsideSince},
      "lastEvaluatedAt" = ${position.recordedAt},
      "lastDistanceKm" = ${transition.lastDistanceKm},
      "lastApproachThresholdKm" = ${transition.lastApproachThresholdKm},
      "updatedAt" = NOW()
    WHERE "id" = ${row.id}
  `);
  if (!transition.event) return { state: transition.state, eventId: null };

  const presentation = eventPresentation(transition.event, transition.eventThresholdKm);
  const outsideDurationMs =
    transition.event === 'RETURNED' && row.outsideSince
      ? Math.max(0, position.recordedAt.getTime() - row.outsideSince.getTime())
      : null;
  const description =
    transition.event === 'APPROACHING'
      ? `До внешней границы разрешённой территории ${distanceKm.toFixed(1)} км.`
      : transition.event === 'OUTSIDE'
        ? `Подтверждён выезд за внешнюю границу разрешённой территории.`
        : `Автомобиль вернулся в разрешённую территорию.`;
  const externalId = [
    row.id,
    `v${row.version}`,
    presentation.type,
    transition.eventThresholdKm ?? 'confirmed',
    position.recordedAt.toISOString(),
  ].join(':');
  const event = await database.vehicleEvent.upsert({
    where: {
      vehicleId_provider_externalId: {
        vehicleId: input.vehicleId,
        provider: 'REGIONAL_GEOFENCE',
        externalId,
      },
    },
    create: {
      companyId: input.companyId,
      vehicleId: input.vehicleId,
      rentalId: row.rentalId,
      clientId: row.clientId,
      type: presentation.type,
      severity: presentation.severity,
      title: presentation.title,
      description,
      location:
        row.currentRegion ?? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`,
      recordedAt: position.recordedAt,
      startLatitude: position.latitude,
      startLongitude: position.longitude,
      details: {
        geofenceVersion: row.version,
        regionCodes: row.regionCodes,
        state: transition.state,
        distanceKm,
        thresholdKm: transition.eventThresholdKm,
        currentRegion: row.currentRegion,
        lastAllowedRegion: row.nearestAllowedRegion,
        confirmationPoints: row.confirmationPoints,
        outsideDurationMs,
        contractNumber: row.contractNumber,
      },
      provider: 'REGIONAL_GEOFENCE',
      externalId,
    },
    update: {},
    select: { id: true },
  });
  return { state: transition.state, eventId: event.id };
}
