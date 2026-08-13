import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import type { FleetImportOperation, FleetImportRow } from './types';

export interface ExistingFleetVehicle {
  id: string;
  internalNumber?: string;
  registrationNumberNormalized: string | null;
  vinNormalized: string | null;
  make: string | null;
  modelName: string | null;
  manufacturedYear: number | null;
}

export interface FleetImportPreviewRow {
  row: FleetImportRow;
  operation: FleetImportOperation;
  vehicleId?: string;
  code?: string;
}

export interface SignedFleetImportPreview {
  companyId: string;
  userId: string;
  expiresAt: number;
  rows: FleetImportRow[];
  archiveIds: string[];
}

export function createFleetImportPreview(
  rows: readonly FleetImportRow[],
  existing: readonly ExistingFleetVehicle[],
) {
  const matched = new Set<string>();
  const previewRows = rows.map((row): FleetImportPreviewRow => {
    const plate = existing.find(
      (vehicle) => vehicle.registrationNumberNormalized === row.registrationNumberNormalized,
    );
    const vin = row.vinNormalized
      ? existing.find((vehicle) => vehicle.vinNormalized === row.vinNormalized)
      : undefined;
    if (plate && vin && plate.id !== vin.id) {
      return { row, operation: 'ERROR', code: 'CONTRADICTORY_MATCH' };
    }
    const vehicle = plate ?? vin;
    if (!vehicle) return { row, operation: 'ADD' };
    if (matched.has(vehicle.id)) {
      return { row, operation: 'ERROR', code: 'DUPLICATE_EXISTING_MATCH' };
    }
    matched.add(vehicle.id);
    const unchanged =
      vehicle.registrationNumberNormalized === row.registrationNumberNormalized &&
      vehicle.vinNormalized === row.vinNormalized &&
      vehicle.make === row.make &&
      vehicle.modelName === row.model &&
      vehicle.manufacturedYear === row.year;
    return { row, operation: unchanged ? 'UNCHANGED' : 'UPDATE', vehicleId: vehicle.id };
  });
  return {
    rows: previewRows,
    optionalArchives: existing
      .filter((vehicle) => !matched.has(vehicle.id))
      .map((vehicle) => ({ id: vehicle.id, internalNumber: vehicle.internalNumber })),
  };
}

function key(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function signFleetImportPreview(payload: SignedFleetImportPreview, secret: string): string {
  if (!secret) throw new Error('Не настроен секрет предпросмотра импорта.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

export function verifyFleetImportPreview(
  token: string,
  secret: string,
  now = Date.now(),
): SignedFleetImportPreview {
  const [ivEncoded, encrypted, tagEncoded, ...extra] = token.split('.');
  if (!ivEncoded || !encrypted || !tagEncoded || extra.length > 0 || !secret) {
    throw new Error('Предпросмотр импорта недействителен.');
  }
  let payload: SignedFleetImportPreview;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key(secret),
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]);
    payload = JSON.parse(clear.toString('utf8')) as SignedFleetImportPreview;
  } catch {
    throw new Error('Предпросмотр импорта недействителен.');
  }
  if (
    !payload.companyId ||
    !payload.userId ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= now ||
    !Array.isArray(payload.rows) ||
    !Array.isArray(payload.archiveIds)
  ) {
    throw new Error('Срок предпросмотра импорта истёк или данные недействительны.');
  }
  return payload;
}
