export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'UNASSIGNED' | 'DISABLED';

export type DeviceConnectionType = 'LTE' | 'GSM' | 'NONE';

export type DevicePowerSource = 'VEHICLE' | 'BATTERY';

export type FirmwareChannel = 'STABLE' | 'BETA';

export type DeviceCommandType = 'REBOOT' | 'SHUTDOWN' | 'UPDATE_FIRMWARE';

export type DeviceCommandStatus = 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type DeviceStatusTone = 'success' | 'danger' | 'warning' | 'neutral';

export type DeviceVehicleSummary = {
  id: string;
  label: string;
  registrationNumber: string | null;
};

export type FirmwareReleaseItem = {
  id: string;
  version: string;
  channel: FirmwareChannel;
  releaseNotes: string;
  isRequired: boolean;
  releasedAt: string;
  createdAt: string;
};

export type DeviceCommandItem = {
  id: string;
  deviceId: string;
  type: DeviceCommandType;
  status: DeviceCommandStatus;
  firmwareReleaseId: string | null;
  targetFirmwareVersion: string | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type DeviceListItem = {
  id: string;
  name: string;
  serialNumber: string;
  imei: string;
  hardwareVersion: string;
  firmwareVersion: string;
  status: DeviceStatus;
  effectiveStatus: DeviceStatus;
  connectionType: DeviceConnectionType;
  mobileOperator: string | null;
  signalStrength: number | null;
  satellitesCount: number | null;
  powerSource: DevicePowerSource;
  externalVoltage: number | null;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  vehicle: DeviceVehicleSummary | null;
  updateAvailable: boolean;
  hasActiveCommand: boolean;
};

export type DeviceDetails = DeviceListItem & {
  positionAccuracyMeters: number | null;
  ignitionOn: boolean;
  isMoving: boolean;
  latitude: number | null;
  longitude: number | null;
  installedAt: string | null;
  createdAt: string;
  updatedAt: string;
  commands: DeviceCommandItem[];
  availableFirmwareReleases: FirmwareReleaseItem[];
};

export type DeviceActionState = {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};
