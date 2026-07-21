import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import type { MaintenanceKind, MaintenanceStatus } from '../types';

interface MaintenanceRepository {
  findMany(args: unknown): Promise<unknown[]>;
}

export type MaintenanceRecordDto = {
  id: string;
  vehicleId: string;
  title: string;
  kind: MaintenanceKind;
  status: MaintenanceStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  targetOdometerKm: number | null;
  provider: string | null;
  costMinor: number | null;
  notes: string | null;
  createdAt: string;
  vehicle: {
    id: string;
    internalNumber: string;
    model: string;
    registrationNumber: string | null;
  };
};

type RawMaintenanceRecord = Omit<
  MaintenanceRecordDto,
  'scheduledAt' | 'completedAt' | 'createdAt' | 'targetOdometerKm'
> & {
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  targetOdometerKm: { toString(): string } | number | null;
};

const maintenanceRecordSelect = {
  id: true,
  vehicleId: true,
  title: true,
  kind: true,
  status: true,
  scheduledAt: true,
  completedAt: true,
  targetOdometerKm: true,
  provider: true,
  costMinor: true,
  notes: true,
  createdAt: true,
  vehicle: {
    select: {
      id: true,
      internalNumber: true,
      model: true,
      registrationNumber: true,
    },
  },
} satisfies Prisma.MaintenanceRecordSelect;

function mapMaintenanceRecord(record: RawMaintenanceRecord): MaintenanceRecordDto {
  return {
    ...record,
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    targetOdometerKm:
      record.targetOdometerKm === null ? null : Number(record.targetOdometerKm.toString()),
    createdAt: record.createdAt.toISOString(),
  };
}

export function createMaintenanceQueries(repository: MaintenanceRepository) {
  return {
    async listMaintenanceForUser(userId: string): Promise<MaintenanceRecordDto[]> {
      const records = await repository.findMany({
        where: { vehicle: { company: { members: { some: { userId } } } } },
        select: maintenanceRecordSelect,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      });

      return (records as RawMaintenanceRecord[]).map(mapMaintenanceRecord);
    },
  };
}

const queries = createMaintenanceQueries({
  findMany: (args) =>
    prisma.maintenanceRecord.findMany(args as Prisma.MaintenanceRecordFindManyArgs),
});

export const listMaintenanceForUser = queries.listMaintenanceForUser;
