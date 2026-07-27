import { describe, expect, it } from 'vitest';

import { createDeviceQueries } from './queries';

const authenticatedContext = {
  userId: 'admin-1',
  companyId: 'company-1',
  companyRole: 'ADMIN' as const,
};

const firmwareReleases = [
  {
    id: 'firmware-241',
    version: '2.4.1',
    channel: 'STABLE' as const,
    releaseNotes: 'Требуемое обновление.',
    isRequired: true,
    releasedAt: new Date('2026-07-26T10:00:00.000Z'),
    createdAt: new Date('2026-07-26T10:00:00.000Z'),
  },
  {
    id: 'firmware-240',
    version: '2.4.0',
    channel: 'STABLE' as const,
    releaseNotes: 'Текущая версия.',
    isRequired: false,
    releasedAt: new Date('2026-07-20T10:00:00.000Z'),
    createdAt: new Date('2026-07-20T10:00:00.000Z'),
  },
];

const rawDevice = {
  id: 'device-1',
  vehicleId: 'vehicle-1',
  name: 'Pilot Connect 0001',
  serialNumber: 'PC-2026-0001',
  imei: '860000000000001',
  hardwareVersion: '1.0.0',
  firmwareVersion: '2.4.0',
  status: 'ONLINE' as const,
  connectionType: 'LTE' as const,
  mobileOperator: 'МТС',
  signalStrength: 88,
  satellitesCount: 14,
  positionAccuracyMeters: { toString: () => '4.25' },
  powerSource: 'VEHICLE' as const,
  externalVoltage: { toString: () => '12.60' },
  batteryLevel: 96,
  ignitionOn: true,
  isMoving: false,
  latitude: { toString: () => '55.755826' },
  longitude: { toString: () => '37.617300' },
  lastSeenAt: new Date('2026-07-27T09:55:00.000Z'),
  installedAt: new Date('2026-07-20T10:00:00.000Z'),
  createdAt: new Date('2026-07-20T10:00:00.000Z'),
  updatedAt: new Date('2026-07-27T09:55:00.000Z'),
  vehicle: {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    registrationNumber: 'А001АА',
  },
  commands: [
    {
      id: 'command-1',
      deviceId: 'device-1',
      type: 'UPDATE_FIRMWARE' as const,
      status: 'COMPLETED' as const,
      firmwareReleaseId: 'firmware-241',
      targetFirmwareVersion: '2.4.1',
      errorMessage: null,
      createdAt: new Date('2026-07-27T08:00:00.000Z'),
      sentAt: new Date('2026-07-27T08:00:05.000Z'),
      completedAt: new Date('2026-07-27T08:02:00.000Z'),
      cancelledAt: null,
    },
  ],
};

function createRepository() {
  const calls: {
    devices?: unknown;
    detail?: unknown;
    firmware?: unknown;
    vehicles?: unknown;
  } = {};

  return {
    calls,
    repository: {
      device: {
        async findMany(args: unknown) {
          calls.devices = args;
          return [rawDevice];
        },
        async findFirst(args: unknown) {
          calls.detail = args;
          return rawDevice;
        },
      },
      firmwareRelease: {
        async findMany(args: unknown) {
          calls.firmware = args;
          return firmwareReleases;
        },
      },
      vehicle: {
        async findMany(args: unknown) {
          calls.vehicles = args;
          return [rawDevice.vehicle];
        },
      },
    },
  };
}

describe('запросы Pilot Connect', () => {
  it('изолирует данные страницы по компании и возвращает сериализуемые DTO', async () => {
    const fake = createRepository();
    const queries = createDeviceQueries(
      fake.repository,
      async () => authenticatedContext,
      () => new Date('2026-07-27T10:00:00.000Z'),
    );

    const page = await queries.getDevicePageData();

    expect(fake.calls.devices).toMatchObject({ where: { companyId: 'company-1' } });
    expect(fake.calls.firmware).toMatchObject({ orderBy: { releasedAt: 'desc' } });
    expect(fake.calls.vehicles).toMatchObject({
      where: { companyId: 'company-1', OR: [{ device: null }] },
    });
    expect(page).toEqual({
      devices: [
        {
          id: 'device-1',
          name: 'Pilot Connect 0001',
          serialNumber: 'PC-2026-0001',
          imei: '860000000000001',
          hardwareVersion: '1.0.0',
          firmwareVersion: '2.4.0',
          status: 'ONLINE',
          effectiveStatus: 'ONLINE',
          connectionType: 'LTE',
          mobileOperator: 'МТС',
          signalStrength: 88,
          satellitesCount: 14,
          powerSource: 'VEHICLE',
          batteryLevel: 96,
          lastSeenAt: '2026-07-27T09:55:00.000Z',
          vehicle: {
            id: 'vehicle-1',
            label: 'PLT-001 · GWM WEY · А001АА',
            registrationNumber: 'А001АА',
          },
          updateAvailable: true,
        },
      ],
      firmwareReleases: [
        {
          id: 'firmware-241',
          version: '2.4.1',
          channel: 'STABLE',
          releaseNotes: 'Требуемое обновление.',
          isRequired: true,
          releasedAt: '2026-07-26T10:00:00.000Z',
          createdAt: '2026-07-26T10:00:00.000Z',
        },
        {
          id: 'firmware-240',
          version: '2.4.0',
          channel: 'STABLE',
          releaseNotes: 'Текущая версия.',
          isRequired: false,
          releasedAt: '2026-07-20T10:00:00.000Z',
          createdAt: '2026-07-20T10:00:00.000Z',
        },
      ],
      availableVehicles: [{ id: 'vehicle-1', label: 'PLT-001 · GWM WEY · А001АА' }],
      summary: { total: 1, online: 1, offline: 0, updateAvailable: 1 },
    });
  });

  it('находит подробности только в текущей компании и сериализует Decimal и даты', async () => {
    const fake = createRepository();
    const queries = createDeviceQueries(
      fake.repository,
      async () => authenticatedContext,
      () => new Date('2026-07-27T10:00:00.000Z'),
    );

    const device = await queries.getDeviceDetails('device-1');

    expect(fake.calls.detail).toMatchObject({
      where: { id: 'device-1', companyId: 'company-1' },
      select: {
        commands: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    expect(device).toMatchObject({
      id: 'device-1',
      positionAccuracyMeters: 4.25,
      externalVoltage: 12.6,
      latitude: 55.755826,
      longitude: 37.6173,
      installedAt: '2026-07-20T10:00:00.000Z',
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-27T09:55:00.000Z',
      commands: [
        expect.objectContaining({
          createdAt: '2026-07-27T08:00:00.000Z',
          sentAt: '2026-07-27T08:00:05.000Z',
          completedAt: '2026-07-27T08:02:00.000Z',
          cancelledAt: null,
        }),
      ],
      availableFirmwareReleases: [expect.objectContaining({ version: '2.4.1' })],
    });
  });

  it('показывает свободные автомобили и текущую привязку только в текущей компании', async () => {
    const fake = createRepository();
    const queries = createDeviceQueries(fake.repository, async () => authenticatedContext);

    await expect(queries.getAvailableVehicles('device-1')).resolves.toEqual([
      { id: 'vehicle-1', label: 'PLT-001 · GWM WEY · А001АА' },
    ]);

    expect(fake.calls.vehicles).toMatchObject({
      where: {
        companyId: 'company-1',
        OR: [{ device: null }, { device: { id: 'device-1' } }],
      },
    });
  });

  it('возвращает пустые результаты без membership, не запрашивая данные другой компании', async () => {
    const fake = createRepository();
    const queries = createDeviceQueries(fake.repository, async () => null);

    await expect(queries.getDevicePageData()).resolves.toEqual({
      devices: [],
      firmwareReleases: [],
      availableVehicles: [],
      summary: { total: 0, online: 0, offline: 0, updateAvailable: 0 },
    });
    await expect(queries.getDeviceDetails('foreign-device')).resolves.toBeNull();
    expect(fake.calls).toEqual({});
  });
});
