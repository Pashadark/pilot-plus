import { describe, expect, it } from 'vitest';

import { seedPilotConnectDevices, type DeviceSeedDatabase } from './device-seed';

type UpsertArguments = {
  where: Record<string, string>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function createDeviceSeedDatabase() {
  const devicesBySerial = new Map<string, Record<string, unknown>>();
  const firmwareByVersion = new Map<string, Record<string, unknown>>();
  const commandsById = new Map<string, Record<string, unknown>>();

  return {
    devicesBySerial,
    firmwareByVersion,
    commandsById,
    database: {
      firmwareRelease: {
        async upsert(arguments_: UpsertArguments) {
          const version = arguments_.where.version;
          const release = { id: `firmware-${version}`, ...arguments_.create, ...arguments_.update };
          firmwareByVersion.set(version, release);
          return release;
        },
      },
      device: {
        async upsert(arguments_: UpsertArguments) {
          const serialNumber = arguments_.where.serialNumber;
          const device = {
            id: `device-${serialNumber}`,
            ...arguments_.create,
            ...arguments_.update,
          };
          devicesBySerial.set(serialNumber, device);
          return device;
        },
      },
      deviceCommand: {
        async upsert(arguments_: UpsertArguments) {
          const id = arguments_.where.id;
          const command = { id, ...arguments_.create, ...arguments_.update };
          commandsById.set(id, command);
          return command;
        },
      },
    } as unknown as DeviceSeedDatabase,
  };
}

const vehicles = Array.from({ length: 23 }, (_, index) => ({
  id: `vehicle-${String(index + 1).padStart(2, '0')}`,
  internalNumber: `PLT-${String(index + 1).padStart(3, '0')}`,
}));

describe('seedPilotConnectDevices', () => {
  it('идемпотентно создаёт 24 устройства, прошивки и исторические команды', async () => {
    const fake = createDeviceSeedDatabase();

    const first = await seedPilotConnectDevices(
      fake.database,
      'pilot-demo-company',
      'admin-user',
      vehicles,
    );
    const second = await seedPilotConnectDevices(
      fake.database,
      'pilot-demo-company',
      'admin-user',
      vehicles,
    );

    expect(first).toEqual({ devices: 24, firmwareReleases: 3, commands: 6 });
    expect(second).toEqual(first);
    expect(fake.devicesBySerial.size).toBe(24);
    expect(
      [...fake.devicesBySerial.values()].filter((device) => device.vehicleId === null),
    ).toHaveLength(1);
    expect(new Set([...fake.devicesBySerial.values()].map((device) => device.imei)).size).toBe(24);
    expect(fake.firmwareByVersion.size).toBe(3);
    expect(fake.commandsById.size).toBe(6);
  });

  it('оставляет двадцать четвёртое устройство свободным с согласованными параметрами', async () => {
    const fake = createDeviceSeedDatabase();

    await seedPilotConnectDevices(fake.database, 'pilot-demo-company', 'admin-user', vehicles);

    expect(fake.devicesBySerial.get('PC-2026-0024')).toMatchObject({
      name: 'Pilot Connect 0024',
      serialNumber: 'PC-2026-0024',
      imei: '860000000000024',
      vehicleId: null,
      status: 'UNASSIGNED',
      connectionType: 'NONE',
      firmwareVersion: '2.4.1',
      powerSource: 'BATTERY',
      batteryLevel: 65,
    });
  });
});
