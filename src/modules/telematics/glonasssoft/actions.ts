import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { buildRealFleetPreview } from './fleet-reconciliation';
import type { ExistingFleetRow, ProviderFleetRow, RealFleetPreview } from './fleet-reconciliation';

const PREVIEW_TTL_MS = 15 * 60 * 1_000;
const AUDIT_EMAIL = 'redacted@audit.invalid';

interface PreviewClaims {
  companyId: string;
  userId: string;
  expiresAt: number;
  provider: ProviderFleetRow[];
  digest: string;
}

export interface FleetDatabase {
  vehicle: {
    findMany(args: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<{ id: string }>;
    updateMany(args: unknown): Promise<{ count: number }>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  telematicsVehicleLink: { upsert(args: unknown): Promise<unknown> };
  auditLog: { create(args: unknown): Promise<unknown> };
}

export class RealFleetApplyError extends Error {
  constructor(
    public readonly code:
      | 'PREVIEW_INVALID'
      | 'PREVIEW_EXPIRED'
      | 'PREVIEW_FORBIDDEN'
      | 'PREVIEW_CHANGED'
      | 'PREVIEW_BLOCKED',
  ) {
    super('Не удалось применить предпросмотр реального автопарка.');
    this.name = 'RealFleetApplyError';
  }
}

function encryptionKey(secret: string): Buffer {
  if (!secret) throw new RealFleetApplyError('PREVIEW_INVALID');
  return createHash('sha256').update(secret, 'utf8').digest();
}

function digest(preview: RealFleetPreview): string {
  return createHash('sha256').update(JSON.stringify(preview), 'utf8').digest('base64url');
}

function encryptClaims(claims: PreviewClaims, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(claims), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

function decryptClaims(token: string, secret: string): PreviewClaims {
  const [iv, encrypted, tag, ...extra] = token.split('.');
  if (!iv || !encrypted || !tag || extra.length > 0) {
    throw new RealFleetApplyError('PREVIEW_INVALID');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(secret),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const value: unknown = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final(),
      ]).toString('utf8'),
    );
    if (
      typeof value !== 'object' ||
      value === null ||
      !('companyId' in value) ||
      typeof value.companyId !== 'string' ||
      !('userId' in value) ||
      typeof value.userId !== 'string' ||
      !('expiresAt' in value) ||
      typeof value.expiresAt !== 'number' ||
      !Number.isSafeInteger(value.expiresAt) ||
      !('provider' in value) ||
      !Array.isArray(value.provider) ||
      !value.provider.every(
        (row) =>
          typeof row === 'object' &&
          row !== null &&
          'externalId' in row &&
          typeof row.externalId === 'string' &&
          'name' in row &&
          typeof row.name === 'string',
      ) ||
      !('digest' in value) ||
      typeof value.digest !== 'string'
    ) {
      throw new RealFleetApplyError('PREVIEW_INVALID');
    }
    return value as PreviewClaims;
  } catch (error) {
    if (error instanceof RealFleetApplyError) throw error;
    throw new RealFleetApplyError('PREVIEW_INVALID');
  }
}

export function createRealFleetPreview(input: {
  companyId: string;
  userId: string;
  existing: readonly ExistingFleetRow[];
  provider: readonly ProviderFleetRow[];
  secret: string;
  now?: number;
}) {
  const preview = buildRealFleetPreview({ existing: input.existing, provider: input.provider });
  const token = encryptClaims(
    {
      companyId: input.companyId,
      userId: input.userId,
      expiresAt: (input.now ?? Date.now()) + PREVIEW_TTL_MS,
      provider: [...input.provider],
      digest: digest(preview),
    },
    input.secret,
  );
  return { preview, token };
}

export async function applyRealFleetPreview(input: {
  companyId: string;
  userId: string;
  token: string;
  secret: string;
  now?: number;
  transaction<T>(callback: (database: FleetDatabase) => Promise<T>): Promise<T>;
  loadExisting(database: FleetDatabase): Promise<ExistingFleetRow[]>;
}) {
  const claims = decryptClaims(input.token, input.secret);
  const now = input.now ?? Date.now();
  if (claims.expiresAt <= now) throw new RealFleetApplyError('PREVIEW_EXPIRED');
  if (claims.companyId !== input.companyId || claims.userId !== input.userId) {
    throw new RealFleetApplyError('PREVIEW_FORBIDDEN');
  }

  return input.transaction(async (database) => {
    const existing = await input.loadExisting(database);
    const preview = buildRealFleetPreview({ existing, provider: claims.provider });
    if (digest(preview) !== claims.digest) throw new RealFleetApplyError('PREVIEW_CHANGED');
    if (preview.blocked.length > 0) throw new RealFleetApplyError('PREVIEW_BLOCKED');

    const vehicleByPlate = new Map(
      existing.flatMap((row) => (row.plate ? [[row.plate, row.id] as const] : [])),
    );
    for (const row of preview.create) {
      const created = await database.vehicle.create({ data: newVehicleData(input.companyId, row) });
      vehicleByPlate.set(row.plate, created.id);
    }
    for (const row of preview.update) {
      const result = await database.vehicle.updateMany({
        where: { id: row.vehicleId, companyId: input.companyId },
        data: vehicleIdentityData(row),
      });
      if (result.count !== 1) throw new RealFleetApplyError('PREVIEW_CHANGED');
      if (row.vehicleId) vehicleByPlate.set(row.plate, row.vehicleId);
    }
    for (const row of preview.archive) {
      const result = await database.vehicle.updateMany({
        where: { id: row.vehicleId, companyId: input.companyId, archivedAt: null },
        data: { archivedAt: new Date(now), archivedByUserId: input.userId },
      });
      if (result.count !== 1) throw new RealFleetApplyError('PREVIEW_CHANGED');
    }
    for (const row of preview.delete) {
      const result = await database.vehicle.deleteMany({
        where: { id: row.vehicleId, companyId: input.companyId, isDemoImport: true },
      });
      if (result.count !== 1) throw new RealFleetApplyError('PREVIEW_CHANGED');
    }
    for (const row of preview.link) {
      const vehicleId = row.vehicleId ?? vehicleByPlate.get(row.plate);
      if (!vehicleId || !row.externalId) throw new RealFleetApplyError('PREVIEW_CHANGED');
      await database.telematicsVehicleLink.upsert({
        where: {
          companyId_provider_externalId: {
            companyId: input.companyId,
            provider: 'GLONASSSOFT',
            externalId: row.externalId,
          },
        },
        create: {
          companyId: input.companyId,
          vehicleId,
          provider: 'GLONASSSOFT',
          externalId: row.externalId,
          registrationNumberNormalized: row.plate,
        },
        update: { vehicleId, registrationNumberNormalized: row.plate },
      });
    }

    const result = {
      created: preview.create.length,
      updated: preview.update.length,
      archived: preview.archive.length,
      deleted: preview.delete.length,
      linked: preview.link.length,
    };
    await database.auditLog.create({
      data: {
        companyId: input.companyId,
        actorUserId: input.userId,
        actorEmailSnapshot: AUDIT_EMAIL,
        action: 'UPDATE',
        entityType: 'VEHICLE',
        entityLabel: 'Синхронизация реального автопарка',
        changes: result,
      },
    });
    return result;
  });
}

function vehicleIdentityData(row: { make: string; model: string; plate: string }) {
  return {
    model: `${row.make} ${row.model}`,
    make: row.make,
    modelName: row.model,
    registrationNumber: row.plate,
    registrationNumberNormalized: row.plate,
    archivedAt: null,
    isDemoImport: false,
  };
}

function newVehicleData(companyId: string, row: { make: string; model: string; plate: string }) {
  return {
    companyId,
    sourceKey: `glonasssoft:${companyId}:${row.plate}`,
    internalNumber: `REAL-${row.plate}`,
    ...vehicleIdentityData(row),
    city: 'Москва',
    transmission: 'Не указано',
    fuelType: 'OTHER',
    seats: 5,
    dailyPriceMinor: 0,
    currency: 'RUB',
    originalPrice: '0 ₽',
    features: [],
    isRentalReady: false,
    status: 'UNKNOWN',
  };
}
