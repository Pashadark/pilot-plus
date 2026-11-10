import 'server-only';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { getRentalAccess } from '@/modules/rentals/server/access';

import type {
  RegionalGeofenceMapView,
  RentalRegionalGeofenceView,
  RussianRegionOption,
} from '../types';

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listRussianRegions(): Promise<RussianRegionOption[]> {
  const rows = await prisma.russianRegion.findMany({
    select: { code: true, nameRu: true, automaticEnforcementAllowed: true },
    orderBy: [{ nameRu: 'asc' }, { code: 'asc' }],
  });
  return rows.map((row) => ({
    code: row.code,
    name: row.nameRu,
    automaticEnforcementAllowed: row.automaticEnforcementAllowed,
  }));
}

export async function getRentalRegionalGeofenceForCurrentUser(
  rentalId: string,
): Promise<RentalRegionalGeofenceView | null> {
  const access = await getRentalAccess();
  if (!access) return null;
  const row = await prisma.rentalRegionalGeofence.findFirst({
    where: {
      rentalId,
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
    },
    select: {
      rentalId: true,
      enabled: true,
      version: true,
      regionCodes: true,
      warningDistanceKm: true,
      attentionDistanceKm: true,
      criticalDistanceKm: true,
      state: true,
      lastDistanceKm: true,
      updatedAt: true,
    },
  });
  if (!row) return null;
  const regions = await prisma.russianRegion.findMany({
    where: { code: { in: row.regionCodes } },
    select: { code: true, nameRu: true, automaticEnforcementAllowed: true },
    orderBy: [{ nameRu: 'asc' }, { code: 'asc' }],
  });
  return {
    ...row,
    state: row.state,
    lastDistanceKm: numberOrNull(row.lastDistanceKm),
    updatedAt: row.updatedAt.toISOString(),
    regions: regions.map((region) => ({
      code: region.code,
      name: region.nameRu,
      automaticEnforcementAllowed: region.automaticEnforcementAllowed,
    })),
  };
}

function userCompanyScope(user: SafeUser) {
  return user.role === 'SUPER_ADMIN' ? {} : { company: { members: { some: { userId: user.id } } } };
}

export async function getActiveVehicleRegionalGeofence(
  user: SafeUser,
  vehicleId: string,
  now = new Date(),
): Promise<RegionalGeofenceMapView | null> {
  const rental = await prisma.rental.findFirst({
    where: {
      vehicleId,
      status: { in: ['CONFIRMED', 'ACTIVE'] },
      startsAt: { lte: now },
      endsAt: { gte: now },
      ...userCompanyScope(user),
      regionalGeofence: { is: { enabled: true } },
    },
    select: {
      id: true,
      regionalGeofence: {
        select: {
          id: true,
          enabled: true,
          version: true,
          state: true,
          lastDistanceKm: true,
          regionCodes: true,
        },
      },
    },
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
  });
  const geofence = rental?.regionalGeofence;
  if (!rental || !geofence) return null;
  const [geometryRows, regionRows] = await Promise.all([
    prisma.$queryRaw<Array<{ geometry: unknown }>>(Prisma.sql`
      SELECT ST_AsGeoJSON(
        ST_Multi(ST_CollectionExtract(ST_SimplifyPreserveTopology("regionUnion", 0.003), 3)),
        6
      )::json AS "geometry"
      FROM "RentalRegionalGeofence"
      WHERE "id" = ${geofence.id} AND "regionUnion" IS NOT NULL
      LIMIT 1
    `),
    prisma.$queryRaw<
      Array<{
        code: string;
        name: string;
        automaticEnforcementAllowed: boolean;
        geometry: RegionalGeofenceMapView['geometry'];
      }>
    >(Prisma.sql`
      SELECT "code", "nameRu" AS "name", "automaticEnforcementAllowed",
        ST_AsGeoJSON(
          ST_Multi(ST_CollectionExtract(ST_SimplifyPreserveTopology("boundary", 0.003), 3)),
          6
        )::json AS "geometry"
      FROM "RussianRegion"
      WHERE "code" = ANY(${geofence.regionCodes}::text[]) AND "boundary" IS NOT NULL
      ORDER BY "nameRu" ASC, "code" ASC
    `),
  ]);
  const geometry = geometryRows[0]?.geometry as RegionalGeofenceMapView['geometry'] | undefined;
  if (!geometry || geometry.type !== 'MultiPolygon') return null;
  return {
    rentalId: rental.id,
    enabled: geofence.enabled,
    version: geofence.version,
    state: geofence.state,
    lastDistanceKm: numberOrNull(geofence.lastDistanceKm),
    geometry,
    regions: regionRows.map((region) => ({
      code: region.code,
      name: region.name,
      automaticEnforcementAllowed: region.automaticEnforcementAllowed,
    })),
    regionFeatures: {
      type: 'FeatureCollection',
      features: regionRows.map((region) => ({
        type: 'Feature',
        properties: { code: region.code, name: region.name },
        geometry: region.geometry,
      })),
    },
  };
}
