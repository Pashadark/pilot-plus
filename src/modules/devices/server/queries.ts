import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { requireAdmin } from '@/modules/auth/dal';

import { canUpdateFirmware } from '../firmware';
import { getEffectiveDeviceStatus } from '../status';
import type {
  DeviceCommandItem,
  DeviceDetails,
  DeviceListItem,
  DeviceStatus,
  DeviceVehicleSummary,
  FirmwareReleaseItem,
} from '../types';

type AuthenticatedDeviceContext = {
  userId: string;
  companyId: string;
  companyRole: 'ADMIN';
};

type DevicePageSummary = {
  total: number;
  online: number;
  offline: number;
  updateAvailable: number;
};

export type DevicePageData = {
  devices: DeviceListItem[];
  firmwareReleases: FirmwareReleaseItem[];
  availableVehicles: Array<{ id: string; label: string }>;
  summary: DevicePageSummary;
};

interface DeviceQueriesRepository {
  device: {
    findMany(args: unknown): Promise<unknown[]>;
    findFirst(args: unknown): Promise<unknown | null>;
  };
  firmwareRelease: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  vehicle: {
    findMany(args: unknown): Promise<unknown[]>;
  };
}

type DecimalValue = { toString(): string } | number;

type RawVehicle = {
  id: string;
  internalNumber: string;
  model: string;
  registrationNumber: string | null;
};

type RawCommand = {
  id: string;
  deviceId: string;
  type: DeviceCommandItem['type'];
  status: DeviceCommandItem['status'];
  firmwareReleaseId: string | null;
  targetFirmwareVersion: string | null;
  errorMessage: string | null;
  createdAt: Date;
  sentAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

type RawFirmwareRelease = Omit<FirmwareReleaseItem, 'releasedAt' | 'createdAt'> & {
  releasedAt: Date;
  createdAt: Date;
};

type RawDevice = {
  id: string;
  vehicleId: string | null;
  name: string;
  serialNumber: string;
  imei: string;
  hardwareVersion: string;
  firmwareVersion: string;
  status: DeviceStatus;
  connectionType: DeviceListItem['connectionType'];
  mobileOperator: string | null;
  signalStrength: number | null;
  satellitesCount: number | null;
  positionAccuracyMeters: DecimalValue | null;
  powerSource: DeviceListItem['powerSource'];
  externalVoltage: DecimalValue | null;
  batteryLevel: number | null;
  ignitionOn: boolean;
  isMoving: boolean;
  latitude: DecimalValue | null;
  longitude: DecimalValue | null;
  lastSeenAt: Date | null;
  installedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: RawVehicle | null;
  commands: RawCommand[];
};

const vehicleSelect = {
  id: true,
  internalNumber: true,
  model: true,
  registrationNumber: true,
} satisfies Prisma.VehicleSelect;

const deviceListSelect = {
  id: true,
  vehicleId: true,
  name: true,
  serialNumber: true,
  imei: true,
  hardwareVersion: true,
  firmwareVersion: true,
  status: true,
  connectionType: true,
  mobileOperator: true,
  signalStrength: true,
  satellitesCount: true,
  powerSource: true,
  batteryLevel: true,
  lastSeenAt: true,
  vehicle: { select: vehicleSelect },
} satisfies Prisma.DeviceSelect;

const deviceDetailsSelect = {
  ...deviceListSelect,
  positionAccuracyMeters: true,
  externalVoltage: true,
  ignitionOn: true,
  isMoving: true,
  latitude: true,
  longitude: true,
  installedAt: true,
  createdAt: true,
  updatedAt: true,
  commands: {
    select: {
      id: true,
      deviceId: true,
      type: true,
      status: true,
      firmwareReleaseId: true,
      targetFirmwareVersion: true,
      errorMessage: true,
      createdAt: true,
      sentAt: true,
      completedAt: true,
      cancelledAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
} satisfies Prisma.DeviceSelect;

const firmwareReleaseSelect = {
  id: true,
  version: true,
  channel: true,
  releaseNotes: true,
  isRequired: true,
  releasedAt: true,
  createdAt: true,
} satisfies Prisma.FirmwareReleaseSelect;

function optionalNumber(value: DecimalValue | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value.toString());
}

function vehicleLabel(vehicle: RawVehicle): string {
  return [vehicle.internalNumber, vehicle.model, vehicle.registrationNumber]
    .filter(Boolean)
    .join(' · ');
}

function mapVehicle(vehicle: RawVehicle): DeviceVehicleSummary {
  return {
    id: vehicle.id,
    label: vehicleLabel(vehicle),
    registrationNumber: vehicle.registrationNumber,
  };
}

function mapFirmwareRelease(release: RawFirmwareRelease): FirmwareReleaseItem {
  return {
    id: release.id,
    version: release.version,
    channel: release.channel,
    releaseNotes: release.releaseNotes,
    isRequired: release.isRequired,
    releasedAt: release.releasedAt.toISOString(),
    createdAt: release.createdAt.toISOString(),
  };
}

function mapCommand(command: RawCommand): DeviceCommandItem {
  return {
    id: command.id,
    deviceId: command.deviceId,
    type: command.type,
    status: command.status,
    firmwareReleaseId: command.firmwareReleaseId,
    targetFirmwareVersion: command.targetFirmwareVersion,
    errorMessage: command.errorMessage,
    createdAt: command.createdAt.toISOString(),
    sentAt: command.sentAt?.toISOString() ?? null,
    completedAt: command.completedAt?.toISOString() ?? null,
    cancelledAt: command.cancelledAt?.toISOString() ?? null,
  };
}

function mapDeviceListItem(
  device: RawDevice,
  firmwareReleases: FirmwareReleaseItem[],
  referenceTime: Date,
): DeviceListItem {
  const effectiveStatus = getEffectiveDeviceStatus(device, referenceTime);

  return {
    id: device.id,
    name: device.name,
    serialNumber: device.serialNumber,
    imei: device.imei,
    hardwareVersion: device.hardwareVersion,
    firmwareVersion: device.firmwareVersion,
    status: device.status,
    effectiveStatus,
    connectionType: device.connectionType,
    mobileOperator: device.mobileOperator,
    signalStrength: device.signalStrength,
    satellitesCount: device.satellitesCount,
    powerSource: device.powerSource,
    batteryLevel: device.batteryLevel,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    vehicle: device.vehicle ? mapVehicle(device.vehicle) : null,
    updateAvailable: firmwareReleases.some((release) =>
      canUpdateFirmware(device.firmwareVersion, release.version),
    ),
  };
}

function mapDeviceDetails(
  device: RawDevice,
  firmwareReleases: FirmwareReleaseItem[],
  referenceTime: Date,
): DeviceDetails {
  return {
    ...mapDeviceListItem(device, firmwareReleases, referenceTime),
    externalVoltage: optionalNumber(device.externalVoltage),
    positionAccuracyMeters: optionalNumber(device.positionAccuracyMeters),
    ignitionOn: device.ignitionOn,
    isMoving: device.isMoving,
    latitude: optionalNumber(device.latitude),
    longitude: optionalNumber(device.longitude),
    installedAt: device.installedAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
    commands: device.commands.map(mapCommand),
    availableFirmwareReleases: firmwareReleases.filter((release) =>
      canUpdateFirmware(device.firmwareVersion, release.version),
    ),
  };
}

const DEVICE_SEVERITY: Record<DeviceStatus, number> = {
  WARNING: 0,
  OFFLINE: 1,
  ONLINE: 2,
  UNASSIGNED: 3,
  DISABLED: 4,
};

function sortDevices(left: DeviceListItem, right: DeviceListItem): number {
  const severityDifference =
    DEVICE_SEVERITY[left.effectiveStatus] - DEVICE_SEVERITY[right.effectiveStatus];
  if (severityDifference !== 0) return severityDifference;

  const leftLastSeenAt = left.lastSeenAt ? Date.parse(left.lastSeenAt) : Number.NEGATIVE_INFINITY;
  const rightLastSeenAt = right.lastSeenAt
    ? Date.parse(right.lastSeenAt)
    : Number.NEGATIVE_INFINITY;
  if (leftLastSeenAt !== rightLastSeenAt) return rightLastSeenAt - leftLastSeenAt;

  return left.serialNumber.localeCompare(right.serialNumber, 'en');
}

function createSummary(devices: DeviceListItem[]): DevicePageSummary {
  return {
    total: devices.length,
    online: devices.filter((device) => device.effectiveStatus === 'ONLINE').length,
    offline: devices.filter((device) => device.effectiveStatus === 'OFFLINE').length,
    updateAvailable: devices.filter((device) => device.updateAvailable).length,
  };
}

export function createDeviceQueries(
  repository: DeviceQueriesRepository,
  getContext: () => Promise<AuthenticatedDeviceContext | null>,
  getReferenceTime: () => Date = () => new Date(),
) {
  async function listFirmwareReleases(): Promise<FirmwareReleaseItem[]> {
    const releases = await repository.firmwareRelease.findMany({
      select: firmwareReleaseSelect,
      orderBy: { releasedAt: 'desc' },
    });

    return (releases as RawFirmwareRelease[]).map(mapFirmwareRelease);
  }

  async function listAvailableVehicles(
    context: AuthenticatedDeviceContext,
    currentDeviceId?: string,
  ): Promise<Array<{ id: string; label: string }>> {
    const orConditions = currentDeviceId
      ? [{ device: null }, { device: { id: currentDeviceId } }]
      : [{ device: null }];
    const vehicles = await repository.vehicle.findMany({
      where: { companyId: context.companyId, OR: orConditions },
      select: vehicleSelect,
      orderBy: [{ model: 'asc' }, { internalNumber: 'asc' }],
    });

    return (vehicles as RawVehicle[]).map((vehicle) => ({
      id: vehicle.id,
      label: vehicleLabel(vehicle),
    }));
  }

  return {
    async getDevicePageData(): Promise<DevicePageData> {
      const context = await getContext();
      if (!context) {
        return {
          devices: [],
          firmwareReleases: [],
          availableVehicles: [],
          summary: { total: 0, online: 0, offline: 0, updateAvailable: 0 },
        };
      }

      const [rawDevices, firmwareReleases, availableVehicles] = await Promise.all([
        repository.device.findMany({
          where: { companyId: context.companyId },
          select: deviceListSelect,
          orderBy: [{ lastSeenAt: 'desc' }, { serialNumber: 'asc' }],
        }),
        listFirmwareReleases(),
        listAvailableVehicles(context),
      ]);
      const referenceTime = getReferenceTime();
      const devices = (rawDevices as RawDevice[])
        .map((device) => mapDeviceListItem(device, firmwareReleases, referenceTime))
        .sort(sortDevices);

      return {
        devices,
        firmwareReleases,
        availableVehicles,
        summary: createSummary(devices),
      };
    },

    async getDeviceDetails(id: string): Promise<DeviceDetails | null> {
      const context = await getContext();
      if (!context) return null;

      const [rawDevice, firmwareReleases] = await Promise.all([
        repository.device.findFirst({
          where: { id, companyId: context.companyId },
          select: deviceDetailsSelect,
        }),
        listFirmwareReleases(),
      ]);

      return rawDevice
        ? mapDeviceDetails(rawDevice as RawDevice, firmwareReleases, getReferenceTime())
        : null;
    },

    async getAvailableVehicles(
      currentDeviceId?: string,
    ): Promise<Array<{ id: string; label: string }>> {
      const context = await getContext();
      return context ? listAvailableVehicles(context, currentDeviceId) : [];
    },
  };
}

async function getAuthenticatedDeviceContext(): Promise<AuthenticatedDeviceContext | null> {
  const user = await requireAdmin();
  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.id, role: 'ADMIN' },
    select: { companyId: true, role: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!membership) return null;

  return {
    userId: user.id,
    companyId: membership.companyId,
    companyRole: membership.role,
  };
}

const queries = createDeviceQueries(
  {
    device: {
      findMany: (args) => prisma.device.findMany(args as Prisma.DeviceFindManyArgs),
      findFirst: (args) => prisma.device.findFirst(args as Prisma.DeviceFindFirstArgs),
    },
    firmwareRelease: {
      findMany: (args) =>
        prisma.firmwareRelease.findMany(args as Prisma.FirmwareReleaseFindManyArgs),
    },
    vehicle: {
      findMany: (args) => prisma.vehicle.findMany(args as Prisma.VehicleFindManyArgs),
    },
  },
  getAuthenticatedDeviceContext,
);

export const getDevicePageData = queries.getDevicePageData;
export const getDeviceDetails = queries.getDeviceDetails;
export const getAvailableVehicles = queries.getAvailableVehicles;
