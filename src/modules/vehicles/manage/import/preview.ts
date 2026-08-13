import { createHmac, timingSafeEqual } from 'node:crypto';

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

function signature(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url');
}

export function signFleetImportPreview(payload: SignedFleetImportPreview, secret: string): string {
  if (!secret) throw new Error('Не настроен секрет предпросмотра импорта.');
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyFleetImportPreview(
  token: string,
  secret: string,
  now = Date.now(),
): SignedFleetImportPreview {
  const [encoded, received, ...extra] = token.split('.');
  if (!encoded || !received || extra.length > 0 || !secret) {
    throw new Error('Предпросмотр импорта недействителен.');
  }
  const expected = signature(encoded, secret);
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (
    receivedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(receivedBytes, expectedBytes)
  ) {
    throw new Error('Предпросмотр импорта недействителен.');
  }
  let payload: SignedFleetImportPreview;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SignedFleetImportPreview;
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
