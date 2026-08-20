import 'server-only';

import { prisma as defaultPrisma } from '@/database/prisma/client';
import { decryptField } from '@/services/security/field-encryption';

import { GlonassSoftClient } from './client.server';

export class TelematicsSyncError extends Error {
  constructor(public readonly code: 'NOT_CONFIGURED') {
    super('Интеграция GLONASSSoft не настроена.');
    this.name = 'TelematicsSyncError';
  }
}

type LastData = Awaited<ReturnType<GlonassSoftClient['getLastData']>>[number];

interface SyncDatabase {
  telematicsIntegration: {
    findUnique(args: unknown): Promise<{
      companyId: string;
      baseUrl: string;
      usernameEncrypted: string;
      passwordEncrypted: string;
      enabled: boolean;
    } | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  telematicsVehicleLink: {
    findMany(args: unknown): Promise<
      Array<{
        vehicleId: string;
        externalId: string;
        registrationNumberNormalized: string;
      }>
    >;
  };
  $transaction<T>(callback: (database: SyncTransaction) => Promise<T>): Promise<T>;
}

interface SyncTransaction {
  vehiclePosition: { upsert(args: unknown): Promise<unknown> };
  vehicle: { updateMany(args: unknown): Promise<{ count: number }> };
}

interface SyncClient {
  getLastData(externalIds: readonly string[]): Promise<readonly LastData[]>;
}

interface SyncDependencies {
  prisma: SyncDatabase;
  createClient(input: { baseUrl: string; username: string; password: string }): SyncClient;
  decrypt(value: string): string;
  now(): Date;
}

export async function syncCompanyLatestPositions(
  companyId: string,
  dependencies?: Partial<SyncDependencies>,
) {
  const deps = {
    prisma: dependencies?.prisma ?? (defaultPrisma as unknown as SyncDatabase),
    createClient: dependencies?.createClient ?? ((input) => new GlonassSoftClient(input)),
    decrypt:
      dependencies?.decrypt ??
      ((value: string) => {
        const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
        if (!encryptionKey) throw new TelematicsSyncError('NOT_CONFIGURED');
        return decryptField(value, encryptionKey);
      }),
    now: dependencies?.now ?? (() => new Date()),
  };
  const integration = await deps.prisma.telematicsIntegration.findUnique({
    where: { companyId, enabled: true },
  });
  if (!integration?.enabled) throw new TelematicsSyncError('NOT_CONFIGURED');

  const links = await deps.prisma.telematicsVehicleLink.findMany({
    where: { companyId, provider: 'GLONASSSOFT', vehicle: { archivedAt: null } },
    orderBy: { externalId: 'asc' },
    select: {
      vehicleId: true,
      externalId: true,
      registrationNumberNormalized: true,
    },
  });
  const attemptedAt = deps.now();
  await deps.prisma.telematicsIntegration.updateMany({
    where: { companyId, enabled: true },
    data: { lastAttemptAt: attemptedAt },
  });
  if (links.length === 0) {
    await deps.prisma.telematicsIntegration.updateMany({
      where: { companyId, enabled: true },
      data: { lastSuccessAt: attemptedAt, lastErrorCode: null },
    });
    return { requested: 0, saved: 0, skipped: 0 };
  }

  try {
    const client = deps.createClient({
      baseUrl: integration.baseUrl,
      username: deps.decrypt(integration.usernameEncrypted),
      password: deps.decrypt(integration.passwordEncrypted),
    });
    const data = await client.getLastData(links.map((link) => link.externalId));
    const linkByExternalId = new Map(links.map((link) => [link.externalId, link]));
    let saved = 0;
    let skipped = 0;
    await deps.prisma.$transaction(async (database) => {
      for (const point of data) {
        const link = linkByExternalId.get(point.externalId);
        if (!link) {
          skipped += 1;
          continue;
        }
        await savePoint(database, companyId, link.vehicleId, point);
        saved += 1;
      }
    });
    const successfulAt = deps.now();
    await deps.prisma.telematicsIntegration.updateMany({
      where: { companyId, enabled: true },
      data: { lastSuccessAt: successfulAt, lastErrorCode: null },
    });
    return { requested: links.length, saved, skipped };
  } catch (error) {
    await deps.prisma.telematicsIntegration.updateMany({
      where: { companyId, enabled: true },
      data: { lastErrorCode: safeErrorCode(error) },
    });
    throw error;
  }
}

async function savePoint(
  database: SyncTransaction,
  companyId: string,
  vehicleId: string,
  point: LastData,
) {
  const recordedAt = new Date(point.recordedAt);
  const providerReceivedAt = new Date(point.receivedAt);
  const externalId = `${point.externalId}:${recordedAt.toISOString()}`;
  await database.vehiclePosition.upsert({
    where: {
      vehicleId_provider_externalId: { vehicleId, provider: 'GLONASSSOFT', externalId },
    },
    create: {
      vehicleId,
      latitude: point.latitude,
      longitude: point.longitude,
      speedKph: Math.round(point.speedKph),
      odometerKm: point.odometerKm,
      fuelLevelPercent: point.fuelPercent,
      address: point.address,
      recordedAt,
      provider: 'GLONASSSOFT',
      externalId,
      providerRecordedAt: recordedAt,
      receivedAt: providerReceivedAt,
    },
    update: {},
  });
  await database.vehicle.updateMany({
    where: { id: vehicleId, companyId, archivedAt: null },
    data: {
      ...(point.odometerKm === null ? {} : { odometerKm: point.odometerKm }),
      status: stateToStatus(point.state),
    },
  });
}

function stateToStatus(state: number) {
  if (state === 4) return 'MOVING';
  if (state === 2 || state === 3) return 'IDLE';
  return 'OFFLINE';
}

function safeErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^(AUTH_REJECTED|TIMEOUT|UNAVAILABLE|INVALID_RESPONSE)$/u.test(error.code)
  ) {
    return error.code;
  }
  return 'UNAVAILABLE';
}
