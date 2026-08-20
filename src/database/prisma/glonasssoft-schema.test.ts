import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync('src/database/prisma/schema.prisma', 'utf8');
const migrationPath =
  'src/database/prisma/migrations/20260820150000_add_glonasssoft_integration/migration.sql';

describe('схема интеграции GLONASSSoft', () => {
  it('хранит одну защищённую настройку телематики на компанию', () => {
    expect(schema).toContain('model TelematicsIntegration {');
    expect(schema).toContain('companyId         String    @unique');
    expect(schema).toContain('usernameEncrypted String');
    expect(schema).toContain('passwordEncrypted String');
    expect(schema).toContain('provider          String    @default("GLONASSSOFT")');
  });

  it('связывает внешний объект с одной машиной внутри компании', () => {
    expect(schema).toContain('model TelematicsVehicleLink {');
    expect(schema).toContain('@@unique([companyId, provider, externalId])');
    expect(schema).toContain('@@unique([companyId, provider, vehicleId])');
  });

  it('делает позиции и события идемпотентными по идентификатору провайдера', () => {
    expect(schema).toContain('@@unique([vehicleId, provider, externalId])');
    expect(schema.match(/@@unique\(\[vehicleId, provider, externalId\]\)/g)).toHaveLength(2);
    expect(schema).toContain('providerRecordedAt DateTime? @db.Timestamptz(3)');
    expect(schema).toContain('receivedAt         DateTime? @db.Timestamptz(3)');
  });

  it('использует только добавочную миграцию без разрушительных операторов', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE "TelematicsIntegration"');
    expect(migration).toContain('CREATE TABLE "TelematicsVehicleLink"');
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  });
});
