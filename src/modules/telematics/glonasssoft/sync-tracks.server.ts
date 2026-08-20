import 'server-only';

import { prisma as defaultPrisma } from '@/database/prisma/client';
import { decryptField } from '@/services/security/field-encryption';

import { GlonassSoftClient } from './client.server';

const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1_000;

export class TrackSyncError extends Error {
  constructor(public readonly code: 'INVALID_RANGE' | 'NOT_FOUND' | 'NOT_CONFIGURED') {
    super('Не удалось загрузить трек GLONASSSoft.');
    this.name = 'TrackSyncError';
  }
}

type TrackPoint = Awaited<ReturnType<GlonassSoftClient['getTerminalMessages']>>[number];

interface TrackDatabase {
  telematicsIntegration: {
    findUnique(args: unknown): Promise<{
      baseUrl: string;
      usernameEncrypted: string;
      passwordEncrypted: string;
      enabled: boolean;
    } | null>;
  };
  telematicsVehicleLink: {
    findFirst(args: unknown): Promise<{ vehicleId: string; externalId: string } | null>;
  };
  $transaction<T>(callback: (database: TrackTransaction) => Promise<T>): Promise<T>;
}

interface TrackTransaction {
  vehiclePosition: { upsert(args: unknown): Promise<unknown> };
}

interface TrackClient {
  getTerminalMessages(input: {
    externalId: string;
    from: Date;
    to: Date;
  }): Promise<readonly TrackPoint[]>;
}

interface TrackDependencies {
  prisma: TrackDatabase;
  createClient(input: { baseUrl: string; username: string; password: string }): TrackClient;
  decrypt(value: string): string;
  now(): Date;
}

export async function syncVehicleTrack(
  input: { companyId: string; vehicleId: string; from: Date; to: Date },
  dependencies?: Partial<TrackDependencies>,
) {
  validateRange(input.from, input.to);
  const deps = {
    prisma: dependencies?.prisma ?? (defaultPrisma as unknown as TrackDatabase),
    createClient: dependencies?.createClient ?? ((options) => new GlonassSoftClient(options)),
    decrypt:
      dependencies?.decrypt ??
      ((value: string) => {
        const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
        if (!key) throw new TrackSyncError('NOT_CONFIGURED');
        return decryptField(value, key);
      }),
    now: dependencies?.now ?? (() => new Date()),
  };
  const link = await deps.prisma.telematicsVehicleLink.findFirst({
    where: {
      companyId: input.companyId,
      vehicleId: input.vehicleId,
      provider: 'GLONASSSOFT',
      vehicle: { archivedAt: null },
    },
    select: { vehicleId: true, externalId: true },
  });
  if (!link) throw new TrackSyncError('NOT_FOUND');
  const integration = await deps.prisma.telematicsIntegration.findUnique({
    where: { companyId: input.companyId, enabled: true },
  });
  if (!integration?.enabled) throw new TrackSyncError('NOT_CONFIGURED');
  const client = deps.createClient({
    baseUrl: integration.baseUrl,
    username: deps.decrypt(integration.usernameEncrypted),
    password: deps.decrypt(integration.passwordEncrypted),
  });
  const points = await client.getTerminalMessages({
    externalId: link.externalId,
    from: input.from,
    to: input.to,
  });
  const receivedAt = deps.now();
  await deps.prisma.$transaction(async (database) => {
    for (const point of points) await saveTrackPoint(database, link.vehicleId, point, receivedAt);
  });
  return { saved: points.length };
}

function validateRange(from: Date, to: Date) {
  const start = from.getTime();
  const end = to.getTime();
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    end - start > MAX_RANGE_MS
  ) {
    throw new TrackSyncError('INVALID_RANGE');
  }
}

async function saveTrackPoint(
  database: TrackTransaction,
  vehicleId: string,
  point: TrackPoint,
  receivedAt: Date,
) {
  const recordedAt = new Date(point.recordedAt);
  await database.vehiclePosition.upsert({
    where: {
      vehicleId_provider_externalId: {
        vehicleId,
        provider: 'GLONASSSOFT',
        externalId: point.externalId,
      },
    },
    create: {
      vehicleId,
      latitude: point.latitude,
      longitude: point.longitude,
      speedKph: Math.round(point.speedKph),
      odometerKm: point.odometerKm,
      recordedAt,
      provider: 'GLONASSSOFT',
      externalId: point.externalId,
      providerRecordedAt: recordedAt,
      receivedAt,
    },
    update: {},
  });
}
