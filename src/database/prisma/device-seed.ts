import type { Prisma, PrismaClient } from './../generated/prisma';

export type DeviceSeedDatabase = {
  firmwareRelease: Pick<PrismaClient['firmwareRelease'], 'upsert'>;
  device: Pick<PrismaClient['device'], 'upsert'>;
  deviceCommand: Pick<PrismaClient['deviceCommand'], 'upsert'>;
};

type DeviceSeedData = Omit<Prisma.DeviceUncheckedCreateInput, 'companyId'>;

const FIRMWARE_RELEASES = [
  {
    version: '2.3.8',
    channel: 'STABLE' as const,
    isRequired: false,
    releaseNotes: 'Стабильная версия Pilot Connect для парка.',
    releasedAt: new Date('2026-03-12T09:00:00.000Z'),
  },
  {
    version: '2.4.0',
    channel: 'STABLE' as const,
    isRequired: false,
    releaseNotes: 'Улучшена стабильность LTE-соединения и позиционирования.',
    releasedAt: new Date('2026-05-20T09:00:00.000Z'),
  },
  {
    version: '2.4.1',
    channel: 'STABLE' as const,
    isRequired: true,
    releaseNotes: 'Обязательное обновление безопасности Pilot Connect.',
    releasedAt: new Date('2026-07-15T09:00:00.000Z'),
  },
];

const DEVICE_STATUSES = [
  'ONLINE',
  'ONLINE',
  'ONLINE',
  'WARNING',
  'ONLINE',
  'OFFLINE',
  'ONLINE',
  'WARNING',
  'ONLINE',
  'OFFLINE',
  'ONLINE',
  'ONLINE',
  'WARNING',
  'ONLINE',
  'OFFLINE',
  'ONLINE',
  'WARNING',
  'ONLINE',
  'ONLINE',
  'OFFLINE',
  'ONLINE',
  'WARNING',
  'ONLINE',
] as const;

const FIRMWARE_VERSIONS = ['2.3.8', '2.4.0', '2.4.1'] as const;

const HISTORICAL_COMMANDS = [
  { deviceNumber: 1, type: 'REBOOT' as const, completedAt: '2026-07-05T08:10:00.000Z' },
  { deviceNumber: 3, type: 'UPDATE_FIRMWARE' as const, completedAt: '2026-07-07T11:25:00.000Z' },
  { deviceNumber: 6, type: 'REBOOT' as const, completedAt: '2026-07-09T14:45:00.000Z' },
  { deviceNumber: 9, type: 'SHUTDOWN' as const, completedAt: '2026-07-11T18:30:00.000Z' },
  { deviceNumber: 12, type: 'UPDATE_FIRMWARE' as const, completedAt: '2026-07-16T09:15:00.000Z' },
  { deviceNumber: 18, type: 'REBOOT' as const, completedAt: '2026-07-19T13:50:00.000Z' },
] as const;

function deviceSerialNumber(number: number) {
  return `PC-2026-${String(number).padStart(4, '0')}`;
}

function deviceImei(number: number) {
  return `860000000000${String(number).padStart(3, '0')}`;
}

function deviceCommandId(serialNumber: string, type: string) {
  return `seed-${serialNumber.toLowerCase()}-${type.toLowerCase()}`;
}

function getLastSeenAt(number: number, status: (typeof DEVICE_STATUSES)[number]) {
  if (status === 'OFFLINE') {
    return new Date(`2026-07-${String(10 + (number % 8)).padStart(2, '0')}T06:30:00.000Z`);
  }

  return new Date(
    `2026-07-${String(20 + (number % 7)).padStart(2, '0')}T${String(8 + (number % 10)).padStart(2, '0')}:15:00.000Z`,
  );
}

function createDeviceData(number: number, vehicleId: string | null): DeviceSeedData {
  const status = DEVICE_STATUSES[number - 1];
  const firmwareVersion = FIRMWARE_VERSIONS[(number - 1) % FIRMWARE_VERSIONS.length];
  const batteryPowered = number % 5 === 0;
  const offline = status === 'OFFLINE';

  return {
    name: `Pilot Connect ${String(number).padStart(4, '0')}`,
    serialNumber: deviceSerialNumber(number),
    imei: deviceImei(number),
    vehicleId,
    hardwareVersion: number % 2 === 0 ? 'PC-2.1' : 'PC-2.0',
    firmwareVersion,
    status,
    connectionType: offline ? 'GSM' : 'LTE',
    mobileOperator: number % 2 === 0 ? 'МТС' : 'МегаФон',
    signalStrength: offline ? 12 : 58 + ((number * 7) % 36),
    satellitesCount: offline ? 0 : 8 + (number % 7),
    positionAccuracyMeters: offline ? null : Number((3.5 + (number % 6) * 0.4).toFixed(2)),
    powerSource: batteryPowered ? 'BATTERY' : 'VEHICLE',
    externalVoltage: batteryPowered ? null : Number((12.2 + (number % 5) * 0.1).toFixed(2)),
    batteryLevel: batteryPowered ? 52 + (number % 6) * 7 : 88 + (number % 5) * 2,
    ignitionOn: !offline && number % 3 === 0,
    isMoving: !offline && number % 4 === 0,
    latitude: Number((56.0102 + number * 0.0061).toFixed(6)),
    longitude: Number((92.8528 + number * 0.0092).toFixed(6)),
    lastSeenAt: getLastSeenAt(number, status),
    installedAt: new Date(`2026-02-${String(1 + (number % 25)).padStart(2, '0')}T10:00:00.000Z`),
  };
}

export async function seedPilotConnectDevices(
  database: DeviceSeedDatabase,
  companyId: string,
  adminUserId: string,
  vehicles: Array<{ id: string; internalNumber: string }>,
): Promise<{ devices: number; firmwareReleases: number; commands: number }> {
  const fleetVehicles = [...vehicles].sort((first, second) =>
    first.internalNumber.localeCompare(second.internalNumber),
  );

  if (fleetVehicles.length < 23) {
    throw new Error('Для seed Pilot Connect требуется не менее 23 автомобилей.');
  }

  const firmwareByVersion = new Map<string, string>();
  for (const release of FIRMWARE_RELEASES) {
    const firmware = await database.firmwareRelease.upsert({
      where: { version: release.version },
      create: release,
      update: release,
    });
    firmwareByVersion.set(release.version, firmware.id);
  }

  const devicesBySerial = new Map<string, string>();
  for (const number of Array.from({ length: 23 }, (_, index) => index + 1)) {
    const data = createDeviceData(number, fleetVehicles[number - 1]?.id ?? null);
    const device = await database.device.upsert({
      where: { serialNumber: data.serialNumber },
      create: { companyId, ...data },
      update: data,
    });
    devicesBySerial.set(data.serialNumber, device.id);
  }

  const unassignedDevice: DeviceSeedData = {
    name: 'Pilot Connect 0024',
    serialNumber: 'PC-2026-0024',
    imei: '860000000000024',
    vehicleId: null,
    hardwareVersion: 'PC-2.1',
    firmwareVersion: '2.4.1',
    status: 'UNASSIGNED' as const,
    connectionType: 'NONE' as const,
    mobileOperator: null,
    signalStrength: null,
    satellitesCount: null,
    positionAccuracyMeters: null,
    powerSource: 'BATTERY' as const,
    externalVoltage: null,
    batteryLevel: 65,
    ignitionOn: false,
    isMoving: false,
    latitude: null,
    longitude: null,
    lastSeenAt: null,
    installedAt: null,
  };
  const savedUnassignedDevice = await database.device.upsert({
    where: { serialNumber: unassignedDevice.serialNumber },
    create: { companyId, ...unassignedDevice },
    update: unassignedDevice,
  });
  devicesBySerial.set(unassignedDevice.serialNumber, savedUnassignedDevice.id);

  for (const command of HISTORICAL_COMMANDS) {
    const serialNumber = deviceSerialNumber(command.deviceNumber);
    const targetFirmwareVersion = command.type === 'UPDATE_FIRMWARE' ? '2.4.1' : null;
    const deviceId = devicesBySerial.get(serialNumber);

    if (!deviceId) {
      throw new Error(`Не найдено устройство ${serialNumber} для истории команд.`);
    }

    const firmwareReleaseId = targetFirmwareVersion
      ? firmwareByVersion.get(targetFirmwareVersion)
      : null;

    if (targetFirmwareVersion && !firmwareReleaseId) {
      throw new Error(`Не найдена прошивка ${targetFirmwareVersion} для истории команд.`);
    }

    const data = {
      companyId,
      deviceId,
      createdByUserId: adminUserId,
      firmwareReleaseId,
      type: command.type,
      status: 'COMPLETED' as const,
      targetFirmwareVersion,
      payload: { source: 'seed', serialNumber },
      errorMessage: null,
      sentAt: new Date(command.completedAt),
      completedAt: new Date(command.completedAt),
      cancelledAt: null,
    };
    await database.deviceCommand.upsert({
      where: { id: deviceCommandId(serialNumber, command.type) },
      create: { id: deviceCommandId(serialNumber, command.type), ...data },
      update: data,
    });
  }

  return {
    devices: 24,
    firmwareReleases: FIRMWARE_RELEASES.length,
    commands: HISTORICAL_COMMANDS.length,
  };
}
