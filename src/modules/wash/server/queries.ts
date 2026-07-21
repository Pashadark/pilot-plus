import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import type { WashKind, WashStatus } from '../types';

interface WashRepository {
  findMany(args: unknown): Promise<unknown[]>;
}

export type WashRecordDto = {
  id: string;
  vehicleId: string;
  kind: WashKind;
  status: WashStatus;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
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

type RawWashRecord = Omit<
  WashRecordDto,
  'scheduledAt' | 'startedAt' | 'completedAt' | 'createdAt'
> & {
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

const washRecordSelect = {
  id: true,
  vehicleId: true,
  kind: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
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
} satisfies Prisma.WashRecordSelect;

function mapWashRecord(record: RawWashRecord): WashRecordDto {
  return {
    ...record,
    scheduledAt: record.scheduledAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function createWashQueries(repository: WashRepository) {
  return {
    async listWashRecordsForUser(userId: string): Promise<WashRecordDto[]> {
      const records = await repository.findMany({
        where: { vehicle: { company: { members: { some: { userId } } } } },
        select: washRecordSelect,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      });

      return (records as RawWashRecord[]).map(mapWashRecord);
    },
  };
}

const queries = createWashQueries({
  findMany: (args) => prisma.washRecord.findMany(args as Prisma.WashRecordFindManyArgs),
});

export const listWashRecordsForUser = queries.listWashRecordsForUser;
