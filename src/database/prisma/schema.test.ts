import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');
const maintenanceBackfill = readFileSync(
  new URL(
    './migrations/20260722023000_backfill_maintenance_legacy_notes/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const maintenanceStatusPreflight = readFileSync(
  new URL('./preflight/maintenance_legacy_statuses.sql', import.meta.url),
  'utf8',
);

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

  it('типизирует ТО и хранит записи моек автомобиля', () => {
    expect(schema).toContain('enum MaintenanceStatus {');
    expect(schema).toContain('enum MaintenanceKind {');
    expect(schema).toContain('enum WashStatus {');
    expect(schema).toContain('enum WashKind {');
    expect(schema).toContain('model WashRecord {');
    expect(schema).toMatch(/kind\s+MaintenanceKind/);
    expect(schema).toMatch(/status\s+MaintenanceStatus/);
    expect(schema).toMatch(/targetOdometerKm\s+Decimal\?/);
    expect(schema).toMatch(/washRecords\s+WashRecord\[\]/);
    expect(schema).toMatch(/status\s+WashStatus\s+@default\(PLANNED\)/);
    expect(schema).toContain('@@index([status, scheduledAt])');
  });

  it('сохраняет legacy-описания ТО и останавливает миграцию при неизвестных статусах', () => {
    expect(maintenanceBackfill).toMatch(/SET "notes" = COALESCE\("notes", "description"\)/);
    expect(maintenanceBackfill).toMatch(
      /SET "status" = 'PLANNED'[\s\S]*WHERE "status" = 'OVERDUE'/,
    );
    expect(maintenanceBackfill).toContain(
      "'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'",
    );
    expect(maintenanceStatusPreflight).toContain('RAISE EXCEPTION');
    expect(maintenanceStatusPreflight).toContain('Сопоставьте их вручную до миграции.');
    expect(maintenanceStatusPreflight).toContain('GROUP BY "status"::text');
  });

  it('preflight останавливает нормализацию недоказуемого legacy OVERDUE', () => {
    expect(maintenanceStatusPreflight).toContain(`"status"::text = 'OVERDUE'`);
    expect(maintenanceStatusPreflight).toContain('"scheduledAt" IS NULL');
    expect(maintenanceStatusPreflight).toContain('"scheduledAt" >= CURRENT_TIMESTAMP');
    expect(maintenanceStatusPreflight).toContain('требуют ручного сопоставления');
  });
});
