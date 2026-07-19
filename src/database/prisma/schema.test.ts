import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');

describe('доменная схема автопарка', () => {
  it('связывает автомобили с компанией и защищает ключ импорта', () => {
    expect(schema).toContain('model Company {');
    expect(schema).toContain('model CompanyMember {');
    expect(schema).toContain('model Vehicle {');
    expect(schema).toMatch(/sourceKey\s+String\s+@unique/);
    expect(schema).toMatch(/companyId\s+String/);
    expect(schema).toContain('@@index([companyId, status])');
    expect(schema).toMatch(/registrationNumber\s+String\?/);
    expect(schema).toMatch(/vin\s+String\?/);
  });

  it('подготавливает историю без создания демонстрационной телеметрии', () => {
    expect(schema).toContain('model VehiclePosition {');
    expect(schema).toContain('model Trip {');
    expect(schema).toContain('model VehicleEvent {');
    expect(schema).toContain('model FuelRecord {');
    expect(schema).toContain('model MaintenanceRecord {');
    expect(schema).toContain('model VehicleDocument {');
    expect(schema).toContain('@@index([vehicleId, recordedAt])');
  });

  it('хранит локальные и исходные адреса фотографий автомобиля', () => {
    expect(schema).toContain('model VehicleImage {');
    expect(schema).toMatch(/images\s+VehicleImage\[\]/);
    expect(schema).toMatch(/localPath\s+String/);
    expect(schema).toMatch(/sourceUrl\s+String/);
    expect(schema).toContain('@@unique([vehicleId, position])');
    expect(schema).toContain('@@index([vehicleId, isPrimary])');
  });
});
