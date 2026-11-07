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
const driverHelperFinesMigrationPath = new URL(
  './migrations/20260817150000_add_driver_helper_fines/migration.sql',
  import.meta.url,
);
const fineInvoiceWorkflowMigrationPath = new URL(
  './migrations/20260818100000_add_fine_invoice_workflow/migration.sql',
  import.meta.url,
);
const maintenanceRepairsMigrationPath = new URL(
  './migrations/20260913193000_add_vehicle_repairs/migration.sql',
  import.meta.url,
);
const serviceVisitMigrationPath = new URL(
  './migrations/20261107100000_add_vehicle_service_visits/migration.sql',
  import.meta.url,
);
const fineArchiveMigrationPath = new URL(
  './migrations/20261107143000_add_fine_archive_status/migration.sql',
  import.meta.url,
);

describe('доменная схема автопарка', () => {
  it('описывает роли, точечные разрешения и журнал аудита центра администрирования', () => {
    expect(schema).toContain('SUPER_ADMIN');
    expect(schema).toContain('MEMBER');
    expect(schema).toContain('COMPANY_ADMIN');
    expect(schema).toMatch(/additionalPermissions\s+CompanyPermission\[\]/);
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

  it('хранит одно активное посещение сервисной зоны на автомобиль', () => {
    expect(schema).toContain('model VehicleServiceVisit {');
    expect(schema).toMatch(/serviceVisits\s+VehicleServiceVisit\[\]/u);
    expect(existsSync(serviceVisitMigrationPath)).toBe(true);
    const migration = readFileSync(serviceVisitMigrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE "VehicleServiceVisit"');
    expect(migration).toContain('VehicleServiceVisit_one_active_per_vehicle');
    expect(migration).toContain('WHERE "exitedAt" IS NULL');
  });

  it('хранит фамилию и необязательное время следующего контакта заявки', () => {
    const leadModel = schema.match(/model Lead \{([\s\S]*?)\n\}/u)?.[1];

    expect(leadModel).toBeDefined();
    expect(leadModel).toMatch(/lastName\s+String\?/u);
    expect(leadModel).toMatch(/nextContactAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/u);
    expect(leadModel).toContain('@@index([companyId, status, nextContactAt])');
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

  it('хранит файлы документов автомобиля только в приватном хранилище', () => {
    expect(schema).toMatch(/storageKey\s+String\?\s+@unique/);
    expect(schema).toMatch(/originalName\s+String\?/);
    expect(schema).toMatch(/verifiedMime\s+String\?/);
    expect(schema).toMatch(/sha256\s+String\?/);
    expect(schema).toMatch(/bytes\s+Int\?/);
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

  it('хранит ремонты, выполненные работы и приватные вложения автомобиля', () => {
    expect(existsSync(maintenanceRepairsMigrationPath)).toBe(true);
    if (!existsSync(maintenanceRepairsMigrationPath)) return;

    const migration = readFileSync(maintenanceRepairsMigrationPath, 'utf8');
    const record = schema.match(/model MaintenanceRecord \{[\s\S]*?\n\}/u)?.[0] ?? '';
    const workItem = schema.match(/model MaintenanceWorkItem \{[\s\S]*?\n\}/u)?.[0] ?? '';
    const attachment = schema.match(/model MaintenanceAttachment \{[\s\S]*?\n\}/u)?.[0] ?? '';
    const rental = schema.match(/model Rental \{[\s\S]*?\n\}/u)?.[0] ?? '';
    const client = schema.match(/model Client \{[\s\S]*?\n\}/u)?.[0] ?? '';

    expect(schema).toContain('enum MaintenanceRecordType {');
    expect(schema).toContain('enum MaintenanceAttachmentKind {');
    expect(schema).toMatch(/MaintenanceStatus \{[\s\S]*\bDAMAGE_REPORTED\b/u);
    expect(schema).toMatch(/MaintenanceStatus \{[\s\S]*\bWAITING_REPAIR\b/u);
    expect(record).toMatch(/recordType\s+MaintenanceRecordType\s+@default\(MAINTENANCE\)/u);
    expect(record).toMatch(/damageReportedAt\s+DateTime\?/u);
    expect(record).toMatch(/startedAt\s+DateTime\?/u);
    expect(record).toMatch(/rentalId\s+String\?/u);
    expect(record).toMatch(/clientId\s+String\?/u);
    expect(record).toMatch(/workItems\s+MaintenanceWorkItem\[\]/u);
    expect(record).toMatch(/attachments\s+MaintenanceAttachment\[\]/u);
    expect(workItem).toMatch(/maintenanceRecordId\s+String/u);
    expect(workItem).toMatch(/costMinor\s+Int\?/u);
    expect(workItem).toMatch(/position\s+Int/u);
    expect(attachment).toMatch(/kind\s+MaintenanceAttachmentKind/u);
    expect(attachment).toMatch(/storageKey\s+String\s+@unique/u);
    expect(attachment).toMatch(/verifiedMime\s+String/u);
    expect(attachment).toMatch(/sha256\s+String/u);
    expect(rental).toMatch(/maintenanceRecords\s+MaintenanceRecord\[\]/u);
    expect(client).toMatch(/maintenanceRecords\s+MaintenanceRecord\[\]/u);
    expect(migration).toContain('CREATE TABLE "public"."MaintenanceWorkItem"');
    expect(migration).toContain('CREATE TABLE "public"."MaintenanceAttachment"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/iu);
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
    expect(schema).toMatch(/phoneEncrypted\s+String\?/);
    expect(schema).toMatch(/phoneIndex\s+String\?/);
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

  it('добавляет tenant-safe домен штрафов Driver Helper add-only миграцией', () => {
    expect(existsSync(driverHelperFinesMigrationPath)).toBe(true);
    if (!existsSync(driverHelperFinesMigrationPath)) return;

    const migration = readFileSync(driverHelperFinesMigrationPath, 'utf8');
    expect(schema).toContain('VIEW_FINES');
    expect(schema).toContain('MANAGE_FINES');
    expect(schema).toContain('model FineIntegration {');
    expect(schema).toContain('model ExternalVehicleLink {');
    expect(schema).toContain('model Fine {');
    expect(schema).toContain('model FineAssignmentHistory {');
    expect(schema).toContain('@@unique([companyId, provider, externalId])');
    expect(schema).toMatch(/tokenEncrypted\s+String/);
    expect(schema).not.toMatch(/token\s+String/);
    expect(migration).toContain('CREATE TABLE "public"."FineIntegration"');
    expect(migration).toContain('CREATE TABLE "public"."Fine"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
    expect(migration).not.toMatch(/^\s*UPDATE\b/im);
  });

  it('хранит доказательства исчезновения штрафа и безопасно переводит его в архив', () => {
    const fineModel = schema.match(/model Fine \{([\s\S]*?)\n\}/u)?.[1];

    expect(fineModel).toBeDefined();
    const fineStatusEnum = schema.match(/enum FineStatus \{([\s\S]*?)\n\}/u)?.[1];
    expect(fineStatusEnum).toMatch(/\bARCHIVED\b/u);
    expect(schema).toContain('enum FineArchiveReason {');
    expect(schema).toContain('MISSING_FROM_PROVIDER');
    expect(schema).toContain('MANUAL_CONFIRMED');
    expect(fineModel).toMatch(
      /providerMissingSince\s+DateTime\?\s+@db\.Timestamptz\(3\)/u,
    );
    expect(fineModel).toMatch(/providerMissingSyncCount\s+Int\s+@default\(0\)/u);
    expect(fineModel).toMatch(/archivedAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/u);
    expect(fineModel).toMatch(/archiveReason\s+FineArchiveReason\?/u);
    expect(existsSync(fineArchiveMigrationPath)).toBe(true);
    if (!existsSync(fineArchiveMigrationPath)) return;

    const migration = readFileSync(fineArchiveMigrationPath, 'utf8');
    expect(migration).toContain(`ALTER TYPE "public"."FineStatus" ADD VALUE 'ARCHIVED'`);
    expect(migration).toContain('CREATE TYPE "public"."FineArchiveReason"');
    expect(migration).toContain('ADD COLUMN "providerMissingSyncCount" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('ADD COLUMN "providerMissingSince" TIMESTAMP(3) WITH TIME ZONE');
    expect(migration).toContain('ADD COLUMN "archivedAt" TIMESTAMP(3) WITH TIME ZONE');
    expect(migration).toContain('ADD COLUMN "archiveReason" "public"."FineArchiveReason"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/iu);
    expect(migration).not.toMatch(/^\s*UPDATE\b/imu);
  });

  it('хранит sandbox-счета штрафов tenant-scoped с идемпотентностью и безопасными суммами', () => {
    expect(existsSync(fineInvoiceWorkflowMigrationPath)).toBe(true);
    if (!existsSync(fineInvoiceWorkflowMigrationPath)) return;

    const migration = readFileSync(fineInvoiceWorkflowMigrationPath, 'utf8');
    const fineModel = schema.match(/model Fine \{([\s\S]*?)\n\}/)?.[1];
    const fineInvoiceModel = schema.match(/model FineInvoice \{([\s\S]*?)\n\}/)?.[1];
    const fineInvoiceItemModel = schema.match(/model FineInvoiceItem \{([\s\S]*?)\n\}/)?.[1];

    expect(schema).toContain('enum FineInvoiceStatus {');
    expect(schema).toContain('SANDBOX_RETURNED');
    expect(schema).not.toContain('RETURNED_PENDING_CHECK');
    expect(schema).toContain('model FineInvoice {');
    expect(schema).toContain('model FineInvoiceItem {');
    expect(fineModel).toBeDefined();
    expect(fineInvoiceModel).toBeDefined();
    expect(fineInvoiceItemModel).toBeDefined();
    if (!fineModel || !fineInvoiceModel || !fineInvoiceItemModel) return;

    expect(fineInvoiceModel).toMatch(/companyId\s+String/);
    expect(fineInvoiceModel).toMatch(
      /company\s+Company\s+@relation\(fields: \[companyId\], references: \[id\], onDelete: Cascade\)/,
    );
    expect(fineInvoiceModel).toMatch(/providerInvoiceId\s+String\?\s+@unique/);
    expect(fineInvoiceModel).toMatch(/idempotencyKey\s+String\s+@unique/);
    expect(fineInvoiceModel).toMatch(/fineAmountMinor\s+BigInt/);
    expect(fineInvoiceModel).toMatch(/commissionAmountMinor\s+BigInt/);
    expect(fineInvoiceModel).toMatch(/totalAmountMinor\s+BigInt/);
    expect(fineInvoiceModel).toMatch(/sandbox\s+Boolean\s+@default\(true\)/);
    expect(fineInvoiceModel).toMatch(/paymentHost\s+String\?\s+@db\.VarChar\(253\)/);
    expect(fineInvoiceModel).toContain('@@unique([companyId, id])');
    expect(fineInvoiceModel).toContain('@@index([companyId, status])');
    expect(fineModel).toContain('@@unique([companyId, id])');
    expect(fineInvoiceItemModel).toMatch(/companyId\s+String/);
    expect(fineInvoiceItemModel).toMatch(/invoiceId\s+String/);
    expect(fineInvoiceItemModel).toMatch(/fineId\s+String/);
    expect(fineInvoiceItemModel).toMatch(/active\s+Boolean\s+@default\(true\)/);
    expect(fineInvoiceItemModel).toMatch(
      /invoice\s+FineInvoice\s+@relation\(fields: \[companyId, invoiceId\], references: \[companyId, id\], onDelete: Cascade\)/,
    );
    expect(fineInvoiceItemModel).toMatch(
      /fine\s+Fine\s+@relation\(fields: \[companyId, fineId\], references: \[companyId, id\], onDelete: Restrict\)/,
    );
    expect(fineInvoiceItemModel).toContain('@@unique([invoiceId, fineId])');
    expect(fineInvoiceItemModel).toContain('@@index([companyId, invoiceId])');
    expect(fineInvoiceItemModel).toContain('@@index([companyId, fineId])');
    expect(schema).toMatch(/comment\s+String\?/);
    expect(schema).toMatch(/commentedAt\s+DateTime\?/);
    expect(schema).toMatch(/assignmentSource\s+FineAssignmentSource\?/);
    expect(schema).toContain('AUTO_EXACT');

    expect(migration).toContain('CREATE TYPE "public"."FineInvoiceStatus"');
    expect(migration).toContain('CREATE TABLE "public"."FineInvoice"');
    expect(migration).toContain('CREATE TABLE "public"."FineInvoiceItem"');
    expect(migration).toContain('CONSTRAINT "FineInvoice_sandbox_check" CHECK ("sandbox" = true)');
    expect(migration).toContain('CONSTRAINT "FineInvoice_paymentHost_hostname_check" CHECK');
    expect(migration).toContain('char_length("paymentHost") BETWEEN 1 AND 253');
    expect(migration).toContain('"paymentHost" ~');
    expect(migration).toContain('Fine_companyId_id_key');
    expect(migration).toContain('FineInvoice_companyId_id_key');
    expect(migration).toContain('FineInvoiceItem_companyId_invoiceId_fkey');
    expect(migration).toContain('FineInvoiceItem_companyId_fineId_fkey');
    expect(migration).toContain('FineInvoice_companyId_status_idx');
    expect(migration).toContain("'SANDBOX_RETURNED'");
    expect(migration).not.toContain("'RETURNED_PENDING_CHECK'");
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "FineInvoiceItem_one_active_invoice_per_fine_key"',
    );
    expect(migration).toContain('WHERE "active" = true');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
    expect(migration).not.toMatch(/^\s*UPDATE\b/im);
  });
});
