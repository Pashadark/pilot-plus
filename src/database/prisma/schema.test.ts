import { existsSync, readFileSync } from 'node:fs';

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
const clientsMigration = readFileSync(
  new URL('./migrations/20260804171000_add_company_clients/migration.sql', import.meta.url),
  'utf8',
);
const clientDocumentsMigrationPath = new URL(
  './migrations/20260804180000_add_client_documents/migration.sql',
  import.meta.url,
);
const clientDocumentUploadIdMigrationPath = new URL(
  './migrations/20260810120000_add_client_document_upload_id/migration.sql',
  import.meta.url,
);
const clientDocumentScanLeaseMigrationPath = new URL(
  './migrations/20260810150000_add_client_document_scan_lease/migration.sql',
  import.meta.url,
);
const clientPhotoUploadLeaseMigrationPath = new URL(
  './migrations/20260810170000_add_client_photo_upload_leases/migration.sql',
  import.meta.url,
);
const clientUploadHardeningMigrationPath = new URL(
  './migrations/20260810190000_harden_client_upload_lifecycle/migration.sql',
  import.meta.url,
);

describe('доменная схема автопарка', () => {
  it('описывает роли, точечные разрешения и журнал аудита центра администрирования', () => {
    expect(schema).toContain('SUPER_ADMIN');
    expect(schema).toContain('MEMBER');
    expect(schema).toContain('COMPANY_ADMIN');
    expect(schema).toContain('additionalPermissions CompanyPermission[]');
    expect(schema).toContain('VIEW_CLIENTS');
    expect(schema).toContain('MANAGE_CLIENTS');
    expect(schema).toContain('model AuditLog {');
    expect(schema).toContain('actorEmailSnapshot String');
    expect(schema).toContain('@@index([companyId, createdAt])');
  });

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

  it('хранит реквизиты демонстрационной компании без обязательного заполнения старых записей', () => {
    for (const field of [
      /inn\s+String\?/,
      /kpp\s+String\?/,
      /ogrn\s+String\?/,
      /directorName\s+String\?/,
      /legalAddress\s+String\?/,
      /actualAddress\s+String\?/,
      /phone\s+String\?/,
      /email\s+String\?/,
      /isDemo\s+Boolean\s+@default\(false\)/,
    ]) {
      expect(schema).toMatch(field);
    }
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

  it('хранит клиентские персональные данные зашифрованными и tenant-scoped', () => {
    expect(schema).toContain('enum ClientStatus {');
    expect(schema).toContain('model Client {');
    expect(schema).toMatch(/phoneEncrypted\s+String/);
    expect(schema).toMatch(/phoneIndex\s+String/);
    expect(schema).toMatch(/passportEncrypted\s+String\?/);
    expect(schema).toMatch(/passportIndex\s+String\?/);
    expect(schema).toMatch(/driverLicenseEncrypted\s+String\?/);
    expect(schema).toMatch(/@@unique\(\[companyId, phoneIndex\]\)/);
    expect(schema).toMatch(/@@index\(\[companyId, status, updatedAt\]\)/);
    expect(schema).toMatch(/clients\s+Client\[\]/);
    expect(schema).toMatch(/createdClients\s+Client\[\]/);
    expect(schema).not.toMatch(/passport\s+String/);
    expect(schema).not.toMatch(/driverLicense\s+String/);
    expect(clientsMigration).toContain('CREATE TABLE "public"."Client"');
    expect(clientsMigration).not.toMatch(/\bDROP\b/i);
  });

  it('описывает приватные версии документов клиентов без публичных адресов', () => {
    expect(existsSync(clientDocumentsMigrationPath)).toBe(true);
    if (!existsSync(clientDocumentsMigrationPath)) return;

    const clientDocumentsMigration = readFileSync(clientDocumentsMigrationPath, 'utf8');

    expect(schema).toContain('enum ClientDocumentCategory {');
    expect(schema).toContain('enum DocumentScanStatus {');
    expect(schema).toContain('model ClientDocument {');
    expect(schema).toContain('model ClientDocumentVersion {');
    expect(schema).toMatch(/companyId\s+String/);
    expect(schema).toMatch(/clientId\s+String/);
    expect(schema).toMatch(/status\s+DocumentScanStatus\s+@default\(UPLOADING\)/);
    expect(schema).toMatch(/storageKey\s+String\s+@unique/);
    expect(schema).toMatch(/originalName\s+String/);
    expect(schema).toMatch(/verifiedMime\s+String/);
    expect(schema).toMatch(/sha256\s+String/);
    expect(schema).toContain('@@unique([companyId, id])');
    expect(schema).toMatch(
      /client\s+Client\s+@relation\(fields: \[companyId, clientId\], references: \[companyId, id\], onDelete: Cascade\)/,
    );
    expect(schema).toMatch(/@@index\(\[companyId, clientId, status\]\)/);
    expect(schema).not.toMatch(/publicUrl\s+String/);
    expect(clientDocumentsMigration).toContain("'VIEW'");
    expect(clientDocumentsMigration).toContain("'DOWNLOAD'");
    expect(clientDocumentsMigration).toContain("'SCAN'");
    expect(clientDocumentsMigration).toContain("'CLIENT_DOCUMENT'");
    expect(clientDocumentsMigration).toContain(
      'CREATE UNIQUE INDEX "Client_companyId_id_key" ON "public"."Client"("companyId", "id")',
    );
    expect(clientDocumentsMigration).toContain(
      'FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    expect(clientDocumentsMigration).not.toMatch(/\bDROP\b/i);
  });

  it('хранит persistent upload id в отдельной add-only миграции Task 3', () => {
    expect(existsSync(clientDocumentUploadIdMigrationPath)).toBe(true);
    if (!existsSync(clientDocumentUploadIdMigrationPath)) return;

    const migration = readFileSync(clientDocumentUploadIdMigrationPath, 'utf8');

    expect(schema).toMatch(/uploadId\s+String\?\s+@unique/);
    expect(migration).toContain('ADD COLUMN "uploadId" TEXT');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "ClientDocumentVersion_uploadId_key" ON "public"."ClientDocumentVersion"("uploadId")',
    );
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toContain('SET NOT NULL');
    expect(migration).not.toMatch(/^\s*UPDATE\b/im);
    expect(migration).not.toContain('20260804180000_add_client_documents');
  });

  it('добавляет nullable scan lease отдельной add-only миграцией для crash recovery', () => {
    expect(existsSync(clientDocumentScanLeaseMigrationPath)).toBe(true);
    if (!existsSync(clientDocumentScanLeaseMigrationPath)) return;

    const migration = readFileSync(clientDocumentScanLeaseMigrationPath, 'utf8');
    expect(schema).toMatch(/scanLeaseExpiresAt\s+DateTime\?/);
    expect(schema).toContain('@@index([scanVerdict, scanLeaseExpiresAt])');
    expect(migration).toContain('ADD COLUMN "scanLeaseExpiresAt" TIMESTAMP(3)');
    expect(migration).toContain(
      'CREATE INDEX "ClientDocumentVersion_scanVerdict_scanLeaseExpiresAt_idx"',
    );
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toContain('SET NOT NULL');
  });

  it('добавляет durable lease для crash-safe загрузки фото отдельной add-only миграцией', () => {
    expect(existsSync(clientPhotoUploadLeaseMigrationPath)).toBe(true);
    if (!existsSync(clientPhotoUploadLeaseMigrationPath)) return;

    const migration = readFileSync(clientPhotoUploadLeaseMigrationPath, 'utf8');
    expect(schema).toContain('model ClientPhotoUpload');
    expect(schema).toMatch(/uploadId\s+String\s+@unique/);
    expect(schema).toMatch(/leaseExpiresAt\s+DateTime\?/);
    expect(schema).toMatch(/committedAt\s+DateTime\?/);
    expect(migration).toContain('CREATE TABLE "public"."ClientPhotoUpload"');
    expect(migration).toContain('ClientPhotoUpload_companyId_clientId_fkey');
    expect(migration).toContain('"committedAt" TIMESTAMP(3)');
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/^\s*UPDATE\b/im);
  });

  it('добавляет durable permits, bounded quarantine и archive cleanup новой rolling-safe миграцией', () => {
    expect(existsSync(clientUploadHardeningMigrationPath)).toBe(true);
    if (!existsSync(clientUploadHardeningMigrationPath)) return;

    const migration = readFileSync(clientUploadHardeningMigrationPath, 'utf8');
    expect(schema).toContain('model ClientUploadPermit {');
    expect(schema).toMatch(/reservedBytes\s+Int/);
    expect(schema).toMatch(/leaseExpiresAt\s+DateTime/);
    expect(schema).toMatch(/scanRetryCount\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/quarantineExpiresAt\s+DateTime\?/);
    expect(schema).toMatch(/cleanupPending\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/cleanupLeaseExpiresAt\s+DateTime\?/);
    expect(schema).toMatch(/storageDeletedAt\s+DateTime\?/);
    expect(migration).toContain('CREATE TABLE "public"."ClientUploadPermit"');
    expect(migration).toContain('ClientUploadPermit_companyId_status_leaseExpiresAt_idx');
    expect(migration).toContain('ClientUploadPermit_userId_createdAt_idx');
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "ClientDocument_clientId_fkey"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
    expect(migration).not.toMatch(/^\s*UPDATE\b/im);
  });
});
