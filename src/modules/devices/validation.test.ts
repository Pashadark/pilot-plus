import { describe, expect, it } from 'vitest';

import {
  bindDeviceSchema,
  cancelDeviceCommandSchema,
  createDeviceCommandSchema,
  createDeviceSchema,
} from './validation';

const validDevice = {
  name: 'Pilot Connect 0147',
  serialNumber: 'PC-0147-A',
  imei: '123456789012345',
  hardwareVersion: '1.0.0',
  firmwareVersion: '1.5.0',
};

describe('createDeviceSchema', () => {
  it('принимает имя длиной от 2 до 80 символов', () => {
    expect(createDeviceSchema.safeParse({ ...validDevice, name: 'ПК' }).success).toBe(true);
    expect(createDeviceSchema.safeParse({ ...validDevice, name: 'П' }).success).toBe(false);
    expect(createDeviceSchema.safeParse({ ...validDevice, name: 'П'.repeat(81) }).success).toBe(
      false,
    );
  });

  it('проверяет серийный номер и IMEI по границам', () => {
    expect(createDeviceSchema.safeParse({ ...validDevice, serialNumber: 'AB-1' }).success).toBe(
      true,
    );
    expect(
      createDeviceSchema.safeParse({ ...validDevice, serialNumber: 'A'.repeat(64) }).success,
    ).toBe(true);
    expect(createDeviceSchema.safeParse({ ...validDevice, serialNumber: 'abc-1' }).success).toBe(
      false,
    );
    expect(createDeviceSchema.safeParse({ ...validDevice, serialNumber: 'ABC' }).success).toBe(
      false,
    );
    expect(
      createDeviceSchema.safeParse({ ...validDevice, serialNumber: 'A'.repeat(65) }).success,
    ).toBe(false);
    expect(createDeviceSchema.safeParse({ ...validDevice, imei: '12345678901234' }).success).toBe(
      false,
    );
    expect(createDeviceSchema.safeParse({ ...validDevice, imei: '1234567890123456' }).success).toBe(
      false,
    );
    expect(createDeviceSchema.safeParse({ ...validDevice, imei: '12345678901234A' }).success).toBe(
      false,
    );
  });

  it('требует числовые версии из трёх сегментов', () => {
    expect(createDeviceSchema.safeParse(validDevice).success).toBe(true);
    expect(createDeviceSchema.safeParse({ ...validDevice, hardwareVersion: '1.0' }).success).toBe(
      false,
    );
    expect(
      createDeviceSchema.safeParse({ ...validDevice, firmwareVersion: 'v1.5.0' }).success,
    ).toBe(false);
  });
});

describe('идентификаторы устройств и команд', () => {
  it('принимает CUID/UUID-подобные идентификаторы и отклоняет пустые или слишком длинные', () => {
    expect(
      bindDeviceSchema.safeParse({ deviceId: 'cmduq79wn0000qz08ax2hn4zj', vehicleId: null })
        .success,
    ).toBe(true);
    expect(
      bindDeviceSchema.safeParse({
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
        vehicleId: '',
      }).success,
    ).toBe(true);
    expect(bindDeviceSchema.safeParse({ deviceId: ' ', vehicleId: null }).success).toBe(false);
    expect(cancelDeviceCommandSchema.safeParse({ commandId: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('createDeviceCommandSchema', () => {
  it('требует firmwareReleaseId для обновления', () => {
    expect(
      createDeviceCommandSchema.safeParse({
        deviceId: 'device-1',
        type: 'UPDATE_FIRMWARE',
      }).success,
    ).toBe(false);
    expect(
      createDeviceCommandSchema.safeParse({
        deviceId: 'device-1',
        type: 'UPDATE_FIRMWARE',
        firmwareReleaseId: 'firmware-1',
      }).success,
    ).toBe(true);
  });

  it('отклоняет поле прошивки для перезагрузки и выключения', () => {
    for (const type of ['REBOOT', 'SHUTDOWN'] as const) {
      expect(
        createDeviceCommandSchema.safeParse({
          deviceId: 'device-1',
          type,
          firmwareReleaseId: 'firmware-1',
        }).success,
      ).toBe(false);
    }
  });
});
