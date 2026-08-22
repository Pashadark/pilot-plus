import { isFleetParkAddress } from './park-status';

export const OFFLINE_AFTER_MS = 15 * 60 * 1000;

export type VehicleGpsStatusKey = 'IN_PARK' | 'MOVING' | 'IDLE' | 'STALE' | 'NO_DATA';
export type VehicleGpsStatusTone = 'success' | 'primary' | 'warning' | 'danger';

export interface VehicleGpsStatusView {
  key: VehicleGpsStatusKey;
  label: string;
  tone: VehicleGpsStatusTone;
  isConnected: boolean;
}

export interface VehicleGpsStatusInput {
  recordedAt: Date | string | number | null | undefined;
  speedKph: number | null | undefined;
  address: string | null | undefined;
  hasCoordinates: boolean;
}

const STATUS_VIEWS: Record<VehicleGpsStatusKey, VehicleGpsStatusView> = {
  IN_PARK: { key: 'IN_PARK', label: 'В парке', tone: 'success', isConnected: true },
  MOVING: { key: 'MOVING', label: 'В движении', tone: 'primary', isConnected: true },
  IDLE: { key: 'IDLE', label: 'Стоит', tone: 'warning', isConnected: true },
  STALE: { key: 'STALE', label: 'Давно не обновлялся', tone: 'danger', isConnected: false },
  NO_DATA: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
};

function timestamp(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

export function deriveVehicleGpsStatus(
  { recordedAt, speedKph, address, hasCoordinates }: VehicleGpsStatusInput,
  now: Date,
): VehicleGpsStatusView {
  const recordedAtMs = timestamp(recordedAt);
  const nowMs = timestamp(now);

  if (!hasCoordinates || recordedAtMs === null || nowMs === null) {
    return STATUS_VIEWS.NO_DATA;
  }

  if (nowMs - recordedAtMs > OFFLINE_AFTER_MS) {
    return STATUS_VIEWS.STALE;
  }

  if (typeof speedKph === 'number' && Number.isFinite(speedKph) && speedKph > 0) {
    return STATUS_VIEWS.MOVING;
  }

  return isFleetParkAddress(address) ? STATUS_VIEWS.IN_PARK : STATUS_VIEWS.IDLE;
}
