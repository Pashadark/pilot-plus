import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import type { MaintenanceKind, MaintenanceStatus } from '../types';
import { getEffectiveMaintenanceStatus } from '../effective-status';

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
  odometerKm: number | null;
  currentOdometerKm: number | null;
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

type DecimalValue = { toString(): string } | number;

type RawMaintenanceRecord = Omit<
  MaintenanceRecordDto,
  | 'scheduledAt'
  | 'completedAt'
  | 'createdAt'
  | 'odometerKm'
  | 'currentOdometerKm'
  | 'targetOdometerKm'
  | 'notes'
  | 'vehicle'
> & {
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  description: string | null;
  odometerKm: DecimalValue | null;
  targetOdometerKm: DecimalValue | null;
  notes: string | null;
  vehicle: MaintenanceRecordDto['vehicle'] & {
    positions: { odometerKm: DecimalValue | null }[];
  };
};

const maintenanceRecordSelect = {
  id: true,
  vehicleId: true,
  title: true,
  kind: true,
  status: true,
  scheduledAt: true,
  completedAt: true,
  description: true,
  odometerKm: true,
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
      positions: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
        select: { odometerKm: true },
      },
    },
  },
} satisfies Prisma.MaintenanceRecordSelect;

function decimalNumber(value: DecimalValue | null) {
  return value === null ? null : Number(value.toString());
}

function mapMaintenanceRecord(
  record: RawMaintenanceRecord,
  referenceTime: Date,
): MaintenanceRecordDto {
  const { description, vehicle, ...fields } = record;

  return {
    ...fields,
    status: getEffectiveMaintenanceStatus(record.status, record.scheduledAt, referenceTime),
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    odometerKm: decimalNumber(record.odometerKm),
    currentOdometerKm: decimalNumber(vehicle.positions[0]?.odometerKm ?? null),
    targetOdometerKm: decimalNumber(record.targetOdometerKm),
    notes: record.notes ?? description,
    createdAt: record.createdAt.toISOString(),
    vehicle: {
      id: vehicle.id,
      internalNumber: vehicle.internalNumber,
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
    },
  };
}

export function createMaintenanceQueries(repository: MaintenanceRepository) {
  return {
    async listMaintenanceForUser(
      userId: string,
      referenceTime = new Date(),
    ): Promise<MaintenanceRecordDto[]> {
      const records = await repository.findMany({
        where: { vehicle: { company: { members: { some: { userId } } } } },
        select: maintenanceRecordSelect,
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
      });

      return (records as RawMaintenanceRecord[]).map((record) =>
        mapMaintenanceRecord(record, referenceTime),
      );
    },
  };
}

const queries = createMaintenanceQueries({
  findMany: (args) =>
    prisma.maintenanceRecord.findMany(args as Prisma.MaintenanceRecordFindManyArgs),
});

export const listMaintenanceForUser = queries.listMaintenanceForUser;
