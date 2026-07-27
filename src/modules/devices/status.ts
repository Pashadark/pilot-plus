import { FiAlertTriangle, FiLink, FiPower, FiWifi, FiWifiOff } from 'react-icons/fi';

import type { DeviceStatus, DeviceStatusTone } from './types';

const DEVICE_STALE_AFTER_MS = 15 * 60 * 1000;

export const DEVICE_STATUS_META = {
  ONLINE: { label: 'Онлайн', tone: 'success', icon: FiWifi },
  OFFLINE: { label: 'Офлайн', tone: 'danger', icon: FiWifiOff },
  WARNING: { label: 'Требует внимания', tone: 'warning', icon: FiAlertTriangle },
  UNASSIGNED: { label: 'Не привязано', tone: 'neutral', icon: FiLink },
  DISABLED: { label: 'Отключено', tone: 'neutral', icon: FiPower },
} as const satisfies Record<
  DeviceStatus,
  { label: string; tone: DeviceStatusTone; icon: typeof FiWifi }
>;

export type DeviceStatusInput = {
  status: DeviceStatus;
  vehicleId: string | null;
  lastSeenAt: Date | null;
};

export function getEffectiveDeviceStatus(
  device: DeviceStatusInput,
  referenceTime = new Date(),
): DeviceStatus {
  if (!device.vehicleId) return 'UNASSIGNED';

  if (
    device.status === 'ONLINE' &&
    (!device.lastSeenAt ||
      referenceTime.getTime() - device.lastSeenAt.getTime() > DEVICE_STALE_AFTER_MS)
  ) {
    return 'OFFLINE';
  }

  return device.status;
}

export function getDeviceStatusMeta(status: DeviceStatus) {
  return DEVICE_STATUS_META[status];
}
