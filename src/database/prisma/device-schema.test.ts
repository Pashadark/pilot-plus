import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync('src/database/prisma/schema.prisma', 'utf8');

describe('схема Pilot Connect', () => {
  it.each(['Device', 'FirmwareRelease', 'DeviceCommand'])('содержит модель %s', (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it('защищает одну активную привязку устройства к автомобилю', () => {
    expect(schema).toContain('vehicleId');
    expect(schema).toContain('@unique');
  });

  it('индексирует tenant и состояние очереди', () => {
    expect(schema).toContain('@@index([companyId, status])');
    expect(schema).toContain('@@index([deviceId, status, createdAt])');
  });
});
