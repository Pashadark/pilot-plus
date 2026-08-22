import type { VehicleStatus } from './types';

const STATUS_LABELS: Record<VehicleStatus, string> = {
  MOVING: 'В движении',
  IDLE: 'Стоит',
  OFFLINE: 'Не на связи',
  MAINTENANCE: 'Обслуживание',
  UNKNOWN: 'Нет телеметрии',
};

export function normalizeFleetParkAddress(address: string | null | undefined) {
  if (!address) return '';
  return address
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[^а-я0-9]+/gu, ' ')
    .trim();
}

export function isFleetParkAddress(address: string | null | undefined) {
  const normalized = normalizeFleetParkAddress(address);
  if (!normalized) return false;
  const isGreenAvenue = /(?:^|\s)зелен(?:ый|ого)\s+проспект(?:\s|$)/u.test(normalized);
  const isHouse22 = /(?:^|\s)(?:д|дом)?\s*22(?:\s|$)/u.test(normalized);
  return isGreenAvenue && isHouse22;
}

export function vehicleStatusLabel(status: VehicleStatus, address?: string | null): string {
  return status === 'IDLE' && isFleetParkAddress(address) ? 'В парке' : STATUS_LABELS[status];
}
