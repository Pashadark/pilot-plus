import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import type { MaintenanceKind, MaintenanceRecordType, MaintenanceStatus } from '../types';
import { getEffectiveMaintenanceStatus } from '../effective-status';

interface MaintenanceRepository {
  findMany(args: unknown): Promise<unknown[]>;
}

export type MaintenanceRecordDto = {
  id: string;
  vehicleId: string;
  title: string;
  description: string | null;
  recordType: MaintenanceRecordType;
  kind: MaintenanceKind;
  status: MaintenanceStatus;
  damageReportedAt: string | null;
  startedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  odometerKm: number | null;
  currentOdometerKm: number | null;
  targetOdometerKm: number | null;
  provider: string | null;
  costMinor: number | null;
  notes: string | null;
  createdAt: string;
  rental: { id: string; contractNumber: string | null } | null;
  client: { id: string; fullName: string } | null;
  workItems: {
    id: string;
    title: string;
    description: string | null;
    costMinor: number | null;
    position: number;
  }[];
  attachments: {
    id: string;
    kind: 'DAMAGE_BEFORE' | 'REPAIR_AFTER' | 'DOCUMENT' | 'RECEIPT';
    originalName: string;
    verifiedMime: string;
    bytes: number;
    caption: string | null;
    createdAt: string;
    url: string;
    isImage: boolean;
  }[];
  vehicle: {
    id: string;
    internalNumber: string;
    model: string;
    registrationNumber: string | null;
    imagePath?: string | null;
  };
};

type DecimalValue = { toString(): string } | number;

type RawMaintenanceRecord = Omit<
  MaintenanceRecordDto,
  | 'scheduledAt'
  | 'damageReportedAt'
  | 'startedAt'
  | 'completedAt'
  | 'createdAt'
  | 'odometerKm'
  | 'currentOdometerKm'
  | 'targetOdometerKm'
  | 'notes'
  | 'attachments'
  | 'client'
  | 'workItems'
  | 'vehicle'
> & {
  scheduledAt: Date | null;
  damageReportedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  description: string | null;
  odometerKm: DecimalValue | null;
  targetOdometerKm: DecimalValue | null;
  notes: string | null;
  rental: MaintenanceRecordDto['rental'];
  client: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
  } | null;
  workItems: MaintenanceRecordDto['workItems'];
  attachments: Array<
    Omit<MaintenanceRecordDto['attachments'][number], 'createdAt' | 'url' | 'isImage'> & {
      createdAt: Date;
      storageKey?: string;
      sha256?: string;
    }
  >;
  vehicle: MaintenanceRecordDto['vehicle'] & {
    odometerKm: DecimalValue | null;
    positions: { odometerKm: DecimalValue | null }[];
    images: { localPath: string }[];
  };
};

const maintenanceRecordSelect = {
  id: true,
  vehicleId: true,
  title: true,
  recordType: true,
  kind: true,
  status: true,
  scheduledAt: true,
  completedAt: true,
  damageReportedAt: true,
  startedAt: true,
  description: true,
  odometerKm: true,
  targetOdometerKm: true,
  provider: true,
  costMinor: true,
  notes: true,
  createdAt: true,
  rental: { select: { id: true, contractNumber: true } },
  client: {
    select: { id: true, firstName: true, middleName: true, lastName: true },
  },
  workItems: {
    orderBy: { position: 'asc' },
    select: { id: true, title: true, description: true, costMinor: true, position: true },
  },
  attachments: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      kind: true,
      originalName: true,
      verifiedMime: true,
      bytes: true,
      caption: true,
      createdAt: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      internalNumber: true,
      model: true,
      registrationNumber: true,
      odometerKm: true,
      positions: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
        select: { odometerKm: true },
      },
      images: {
        where: { isPrimary: true },
        orderBy: { position: 'asc' },
        take: 1,
        select: { localPath: true },
      },
    },
  },
} satisfies Prisma.MaintenanceRecordSelect;

function decimalNumber(value: DecimalValue | null) {
  return value === null ? null : Number(value.toString());
}

function currentOdometerKm(...readings: Array<DecimalValue | null | undefined>) {
  const values = readings
    .map((reading) => (reading == null ? null : decimalNumber(reading)))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return values.length ? Math.max(...values) : null;
}

function fullName(client: NonNullable<RawMaintenanceRecord['client']>) {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
}

function mapMaintenanceRecord(
  record: RawMaintenanceRecord,
  referenceTime: Date,
): MaintenanceRecordDto {
  const { vehicle } = record;

  return {
    id: record.id,
    vehicleId: record.vehicleId,
    title: record.title,
    description: record.description,
    recordType: record.recordType,
    kind: record.kind,
    status: getEffectiveMaintenanceStatus(record.status, record.scheduledAt, referenceTime),
    damageReportedAt: record.damageReportedAt?.toISOString() ?? null,
    startedAt: record.startedAt?.toISOString() ?? null,
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    odometerKm: decimalNumber(record.odometerKm),
    currentOdometerKm: currentOdometerKm(vehicle.odometerKm, vehicle.positions[0]?.odometerKm),
    targetOdometerKm: decimalNumber(record.targetOdometerKm),
    notes: record.notes ?? record.description,
    provider: record.provider,
    costMinor: record.costMinor,
    createdAt: record.createdAt.toISOString(),
    rental: record.rental,
    client: record.client ? { id: record.client.id, fullName: fullName(record.client) } : null,
    workItems: record.workItems,
    attachments: record.attachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      originalName: attachment.originalName,
      verifiedMime: attachment.verifiedMime,
      bytes: attachment.bytes,
      caption: attachment.caption,
      createdAt: attachment.createdAt.toISOString(),
      url: `/maintenance/${record.id}/attachments/${attachment.id}`,
      isImage: attachment.verifiedMime.startsWith('image/'),
    })),
    vehicle: {
      id: vehicle.id,
      internalNumber: vehicle.internalNumber,
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
      imagePath: vehicle.images[0]?.localPath ?? null,
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
