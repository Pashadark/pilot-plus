import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { requireAdminCenterAccess } from '@/modules/admin/access/server';

const ONLINE_AFTER_MS = 15 * 60_000;
const STALE_AFTER_MS = 24 * 60 * 60_000;

export type GlonassTrackerStatus = 'ONLINE' | 'STALE' | 'OFFLINE' | 'NO_DATA';

export type GlonassTrackerItem = {
  id: string;
  externalId: string;
  provider: string;
  status: GlonassTrackerStatus;
  lastSeenAt: string | null;
  speedKph: number | null;
  heading: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  vehicle: {
    id: string;
    internalNumber: string;
    name: string;
    registrationNumber: string | null;
  };
};

type Repository = {
  telematicsVehicleLink: { findMany(args: unknown): Promise<unknown[]> };
};

type Context = { companyId: string };

function trackerStatus(recordedAt: Date | null, now: Date): GlonassTrackerStatus {
  if (!recordedAt) return 'NO_DATA';
  const age = Math.max(0, now.getTime() - recordedAt.getTime());
  if (age <= ONLINE_AFTER_MS) return 'ONLINE';
  if (age <= STALE_AFTER_MS) return 'STALE';
  return 'OFFLINE';
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function createGlonassDeviceQueries(
  repository: Repository,
  getContext: () => Promise<Context | null>,
  getNow: () => Date = () => new Date(),
) {
  return {
    async getPageData() {
      const context = await getContext();
      if (!context) {
        return {
          trackers: [] as GlonassTrackerItem[],
          summary: { total: 0, online: 0, stale: 0, offline: 0 },
        };
      }
      const rows = (await repository.telematicsVehicleLink.findMany({
        where: { companyId: context.companyId, provider: 'GLONASSSOFT' },
        select: {
          id: true,
          externalId: true,
          provider: true,
          updatedAt: true,
          vehicle: {
            select: {
              id: true,
              internalNumber: true,
              make: true,
              modelName: true,
              model: true,
              registrationNumber: true,
              positions: {
                where: { provider: 'GLONASSSOFT' },
                select: {
                  recordedAt: true,
                  speedKph: true,
                  heading: true,
                  latitude: true,
                  longitude: true,
                  address: true,
                },
                orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
                take: 1,
              },
            },
          },
        },
        orderBy: [{ vehicle: { registrationNumber: 'asc' } }, { externalId: 'asc' }],
      })) as Array<{
        id: string;
        externalId: string;
        provider: string;
        vehicle: {
          id: string;
          internalNumber: string;
          make: string | null;
          modelName: string | null;
          model: string;
          registrationNumber: string | null;
          positions: Array<{
            recordedAt: Date;
            speedKph: number | null;
            heading: number | null;
            latitude: unknown;
            longitude: unknown;
            address: string | null;
          }>;
        };
      }>;
      const now = getNow();
      const trackers = rows.map((row): GlonassTrackerItem => {
        const position = row.vehicle.positions[0] ?? null;
        return {
          id: row.id,
          externalId: row.externalId,
          provider: row.provider,
          status: trackerStatus(position?.recordedAt ?? null, now),
          lastSeenAt: position?.recordedAt.toISOString() ?? null,
          speedKph: position?.speedKph ?? null,
          heading: position?.heading ?? null,
          latitude: optionalNumber(position?.latitude),
          longitude: optionalNumber(position?.longitude),
          address: position?.address ?? null,
          vehicle: {
            id: row.vehicle.id,
            internalNumber: row.vehicle.internalNumber,
            name:
              [row.vehicle.make, row.vehicle.modelName].filter(Boolean).join(' ') ||
              row.vehicle.model,
            registrationNumber: row.vehicle.registrationNumber,
          },
        };
      });
      return {
        trackers,
        summary: {
          total: trackers.length,
          online: trackers.filter((item) => item.status === 'ONLINE').length,
          stale: trackers.filter((item) => item.status === 'STALE').length,
          offline: trackers.filter(
            (item) => item.status === 'OFFLINE' || item.status === 'NO_DATA',
          ).length,
        },
      };
    },
  };
}

async function getContext(): Promise<Context | null> {
  const access = await requireAdminCenterAccess();
  const membership = await prisma.companyMember.findFirst({
    where: { userId: access.user.id, role: 'COMPANY_ADMIN' },
    select: { companyId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (membership) return { companyId: membership.companyId };
  if (access.scope !== 'SYSTEM') return null;
  const company = await prisma.company.findFirst({
    where: { telematicsIntegration: { is: { provider: 'GLONASSSOFT', enabled: true } } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return company ? { companyId: company.id } : null;
}

const queries = createGlonassDeviceQueries(
  {
    telematicsVehicleLink: {
      findMany: (args) => prisma.telematicsVehicleLink.findMany(args as Prisma.TelematicsVehicleLinkFindManyArgs),
    },
  },
  getContext,
);

export const getGlonassDevicePageData = queries.getPageData;
