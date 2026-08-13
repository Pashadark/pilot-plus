import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { registrationNumberHomoglyphs } from '../../modules/vehicles/manage/validation';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');
const migrationPath = new URL(
  './migrations/20260813090008_add_rental_domain_structures/migration.sql',
  import.meta.url,
);
const vehicleColumnsMigrationPath = new URL(
  './migrations/20260813090000_add_vehicle_legal_columns/migration.sql',
  import.meta.url,
);
const vehicleBackfillMigrationPath = new URL(
  './migrations/20260813090001_backfill_vehicle_legal_identifiers/migration.sql',
  import.meta.url,
);
const foreignKeysMigrationPath = new URL(
  './migrations/20260813090009_add_rental_domain_foreign_keys/migration.sql',
  import.meta.url,
);
const foreignKeyValidationMigrationPath = new URL(
  './migrations/20260813090010_validate_vehicle_archived_by_user_foreign_key/migration.sql',
  import.meta.url,
);
const rentalNumberCounterMigrationPath = new URL(
  './migrations/20260813090011_add_rental_number_counter/migration.sql',
  import.meta.url,
);
const rentalConfirmationActorMigrationPath = new URL(
  './migrations/20260813090012_add_rental_confirmation_actor/migration.sql',
  import.meta.url,
);
const rentalDocumentGenerationMigrationPath = new URL(
  './migrations/20260813090101_add_rental_document_generation_lifecycle/migration.sql',
  import.meta.url,
);
const migrationRecoveryRunbookPath = new URL(
  '../../../docs/runbooks/rental-migration-recovery.md',
  import.meta.url,
);
const concurrentIndexMigrationPaths = [
  './migrations/20260813090002_add_vehicle_company_id_key_concurrently/migration.sql',
  './migrations/20260813090003_add_vehicle_registration_number_key_concurrently/migration.sql',
  './migrations/20260813090004_add_vehicle_vin_key_concurrently/migration.sql',
  './migrations/20260813090005_add_vehicle_archived_at_index_concurrently/migration.sql',
  './migrations/20260813090006_add_client_document_company_client_id_key_concurrently/migration.sql',
  './migrations/20260813090007_add_client_document_version_document_id_key_concurrently/migration.sql',
].map((path) => new URL(path, import.meta.url));

const normalizeVin = (value: string) => value.trim().toUpperCase() || null;

const plateHomoglyphMapping = [
  ['A', 'А'],
  ['B', 'В'],
  ['C', 'С'],
  ['E', 'Е'],
  ['H', 'Н'],
  ['K', 'К'],
  ['M', 'М'],
  ['O', 'О'],
  ['P', 'Р'],
  ['T', 'Т'],
  ['X', 'Х'],
  ['Y', 'У'],
] as const;

const calculationPermits = ({
  dailyRateMinor,
  billableDays,
  basePriceMinor,
  discountMinor,
  servicesMinor,
  totalPriceMinor,
  priceOverrideReason,
}: {
  dailyRateMinor: bigint;
  billableDays: number;
  basePriceMinor: bigint;
  discountMinor: bigint;
  servicesMinor: bigint;
  totalPriceMinor: bigint;
  priceOverrideReason: string | null;
}) => {
  const hasGenuineOverride = priceOverrideReason?.trim().length;
  return Boolean(
    hasGenuineOverride ||
    (dailyRateMinor * BigInt(billableDays) === basePriceMinor &&
      totalPriceMinor === basePriceMinor - discountMinor + servicesMinor),
  );
};

describe('доменная схема аренды', () => {
  it('описывает статусы аренды и форматы документов', () => {
    expect(schema).toContain('enum RentalStatus {');
    expect(schema).toContain('DRAFT');
    expect(schema).toContain('CONFIRMED');
    expect(schema).toContain('ACTIVE');
    expect(schema).toContain('COMPLETED');
    expect(schema).toContain('CANCELLED');
    expect(schema).toContain('enum RentalDocumentFormat {');
    expect(schema).toContain('DOCX');
    expect(schema).toContain('PDF');
  });

  it.each(['Rental', 'RentalDriver', 'RentalDocumentVersion', 'ContractTemplateVersion'])(
    'содержит модель %s',
    (model) => {
      expect(schema).toContain(`model ${model} {`);
    },
  );

  it('allocates company-scoped annual rental numbers through an additive counter', () => {
    const counter = schema.match(/model RentalNumberCounter \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(counter).toMatch(/companyId\s+String/);
    expect(counter).toMatch(/year\s+Int/);
    expect(counter).toMatch(/nextValue\s+Int/);
    expect(counter).toContain('@@id([companyId, year])');
    expect(existsSync(rentalNumberCounterMigrationPath)).toBe(true);
    if (!existsSync(rentalNumberCounterMigrationPath)) return;
    const migration = readFileSync(rentalNumberCounterMigrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE "public"."RentalNumberCounter"');
    expect(migration).toContain('"nextValue" INTEGER NOT NULL');
    expect(migration).toContain('RentalNumberCounter_pkey');
    expect(migration).toContain('RentalNumberCounter_companyId_fkey');
    expect(migration).toContain('RentalNumberCounter_nextValue_positive_check');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
  });

  it('records the confirming actor and audits rentals through additive schema changes', () => {
    const rental = schema.match(/model Rental \{[\s\S]*?\n\}/)?.[0] ?? '';
    const user = schema.match(/model User \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(schema).toMatch(/enum AuditEntityType \{[\s\S]*\bRENTAL\b/);
    expect(rental).toMatch(/confirmedByUserId\s+String\?/);
    expect(rental).toMatch(/confirmedBy\s+User\?\s+@relation\("RentalConfirmedBy"/);
    expect(rental).toContain('@@index([companyId, confirmedByUserId, confirmedAt])');
    expect(user).toMatch(/confirmedRentals\s+Rental\[\]\s+@relation\("RentalConfirmedBy"\)/);
    expect(existsSync(rentalConfirmationActorMigrationPath)).toBe(true);
    if (!existsSync(rentalConfirmationActorMigrationPath)) return;
    const migration = readFileSync(rentalConfirmationActorMigrationPath, 'utf8');
    expect(migration).toContain(
      'ALTER TYPE "public"."AuditEntityType" ADD VALUE IF NOT EXISTS \'RENTAL\'',
    );
    expect(migration).toContain('ADD COLUMN "confirmedByUserId" TEXT');
    expect(migration).toContain('Rental_confirmedByUserId_fkey');
    expect(migration).toContain('Rental_companyId_confirmedByUserId_confirmedAt_idx');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
  });

  it('persists a tenant-scoped, leased document-generation lifecycle and legal content version', () => {
    const generation = schema.match(/model RentalDocumentGeneration \{[\s\S]*?\n\}/)?.[0] ?? '';
    const template = schema.match(/model ContractTemplateVersion \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(schema).toContain('enum RentalDocumentGenerationStatus {');
    expect(generation).toMatch(/status\s+RentalDocumentGenerationStatus\s+@default\(PENDING\)/);
    expect(generation).toMatch(/leaseExpiresAt\s+DateTime\?/);
    expect(generation).toMatch(/docxQuarantineKey\s+String\s+@unique/);
    expect(generation).toMatch(/pdfQuarantineKey\s+String\s+@unique/);
    expect(generation).toMatch(/docxStorageKey\s+String\s+@unique/);
    expect(generation).toMatch(/pdfStorageKey\s+String\s+@unique/);
    expect(generation).toContain('@@unique([rentalId, version])');
    expect(template).toMatch(/legalContentVersion\s+String\s+@default\("legal-content-v1"\)/);
    expect(existsSync(rentalDocumentGenerationMigrationPath)).toBe(true);
    if (!existsSync(rentalDocumentGenerationMigrationPath)) return;
    const migration = readFileSync(rentalDocumentGenerationMigrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE "RentalDocumentGeneration"');
    expect(migration).toContain('CREATE TYPE "RentalDocumentGenerationStatus"');
    expect(migration).toContain('ADD COLUMN "legalContentVersion" TEXT NOT NULL DEFAULT');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
  });

  it('связывает аренду с tenant, клиентом, автомобилем, автором и версией шаблона', () => {
    expect(schema).toMatch(/companyId\s+String/);
    expect(schema).toMatch(/clientId\s+String/);
    expect(schema).toMatch(/vehicleId\s+String/);
    expect(schema).toMatch(/createdByUserId\s+String/);
    expect(schema).toMatch(/templateVersionId\s+String/);
    const companyModel = schema.match(/model Company \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(companyModel).toMatch(/rentalDocumentVersions\s+RentalDocumentVersion\[\]/);
    expect(schema).toContain('@@unique([companyId, contractNumber])');
    expect(schema).toContain('@@index([companyId, vehicleId, startsAt])');
  });

  it('хранит точный интервал, расчет в minor units и неизменяемый снимок договора', () => {
    expect(schema).toMatch(/startsAt\s+DateTime/);
    expect(schema).toMatch(/endsAt\s+DateTime/);
    expect(schema).toMatch(/dailyRateMinor\s+BigInt/);
    expect(schema).toMatch(/totalPriceMinor\s+BigInt/);
    expect(schema).toMatch(/currency\s+String\s+@db\.Char\(3\)/);
    expect(schema).toMatch(/snapshotVersion\s+Int/);
    expect(schema).toMatch(/snapshot\s+Json/);
    expect(schema).toMatch(/confirmedAt\s+DateTime\?/);
    expect(schema).toMatch(/cancelledAt\s+DateTime\?/);
  });

  it('хранит приватные метаданные пары документов без public URL', () => {
    expect(schema).toMatch(/format\s+RentalDocumentFormat/);
    expect(schema).toMatch(/storageKey\s+String\s+@unique/);
    expect(schema).toMatch(/sha256\s+String/);
    expect(schema).toMatch(/bytes\s+Int/);
    expect(schema).toMatch(/status\s+DocumentScanStatus/);
    expect(schema).toMatch(/clientDocumentVersionId\s+String/);
    expect(schema).not.toMatch(/publicUrl\s+String/);
  });

  it('расширяет юридические реквизиты компании и rental-поля автомобиля без замены legacy-полей', () => {
    for (const field of [
      'legalName',
      'ogrnip',
      'bankName',
      'settlementAccount',
      'correspondentAccount',
      'bik',
      'contractCity',
      'defaultPickupAddress',
      'defaultReturnAddress',
      'signatoryName',
      'signatoryAuthority',
      'make',
      'modelName',
      'registrationNumberNormalized',
      'manufacturedYear',
      'bodyType',
      'depositMinor',
      'rangePriceMinor',
      'includedMileageKm',
      'overageMileagePriceMinor',
      'missingFuelPriceMinor',
      'isRentalReady',
      'archivedAt',
    ]) {
      expect(schema).toContain(field);
    }

    expect(schema).toMatch(/model\s+String/);
    expect(schema).toContain('@@unique([companyId, registrationNumberNormalized])');
    expect(schema).toContain('vinNormalized                 String?');
    expect(schema).toContain('@@unique([companyId, vinNormalized])');
  });

  it('поставляет add-only rolling migration с SQL-ограничениями интервала и стоимости', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE "public"."Rental"');
    expect(migration).toContain('Rental_endsAt_after_startsAt_check');
    expect(migration).toContain('Rental_non_negative_amounts_check');
    expect(migration).toContain('Rental_vehicle_active_interval_excl');
    expect(migration).toContain(`tstzrange("startsAt", "endsAt", '[)')`);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
    expect(migration).not.toContain('SET NOT NULL');
    expect(
      migration.match(/CONSTRAINT "RentalDocumentVersion_clientDocumentVersionId_key" UNIQUE/g),
    ).toHaveLength(1);
    expect(
      migration.match(
        /CONSTRAINT "RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_key" UNIQUE/g,
      ),
    ).toHaveLength(1);
    expect(migration).not.toContain(
      'CREATE UNIQUE INDEX "RentalDocumentVersion_clientDocumentVersionId_key"',
    );
    expect(migration).not.toContain(
      'CREATE UNIQUE INDEX "RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_key"',
    );
  });

  it('фиксирует rental-документ в tenant-scoped истории CONTRACT без дублирования метаданных файла', () => {
    const rentalDocumentModel =
      schema.match(/model RentalDocumentVersion \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(rentalDocumentModel).toMatch(/companyId\s+String/);
    expect(rentalDocumentModel).toMatch(/clientId\s+String/);
    expect(rentalDocumentModel).toMatch(/clientDocumentId\s+String/);
    expect(rentalDocumentModel).toMatch(/clientDocumentVersionId\s+String\s+@unique/);
    expect(rentalDocumentModel).toMatch(
      /rental\s+Rental\s+@relation\(fields: \[companyId, clientId, rentalId\], references: \[companyId, clientId, id\]/,
    );
    expect(rentalDocumentModel).toMatch(/@@unique\(\[rentalId, version, format\]\)/);
    expect(rentalDocumentModel).not.toMatch(/storageKey\s+String/);
    expect(rentalDocumentModel).not.toMatch(/sha256\s+String/);
    expect(rentalDocumentModel).not.toMatch(/bytes\s+Int/);
    expect(rentalDocumentModel).not.toMatch(/status\s+DocumentScanStatus/);
  });

  it('uses UTC instants and bigint minor units for new rental data', () => {
    const rentalModel = schema.match(/model Rental \{[\s\S]*?\n\}/)?.[0] ?? '';
    const vehicleModel = schema.match(/model Vehicle \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(rentalModel).toMatch(/startsAt\s+DateTime\s+@db\.Timestamptz\(3\)/);
    expect(rentalModel).toMatch(/confirmedAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
    expect(rentalModel).toMatch(/totalPriceMinor\s+BigInt/);
    expect(rentalModel).toMatch(/snapshotVersion\s+Int/);
    expect(vehicleModel).toMatch(/valueMinor\s+BigInt\?/);
    expect(vehicleModel).toMatch(/rangePriceMinor\s+BigInt\?/);
    expect(vehicleModel).toMatch(/depositMinor\s+BigInt\?/);
    expect(schema).toMatch(/lessorBirthDate\s+DateTime\?\s+@db\.Date/);
  });

  it('stages populated legacy vehicle data before tenant uniqueness and keeps old writers normalized', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    const vehicleColumnsMigration = readFileSync(vehicleColumnsMigrationPath, 'utf8');
    const vehicleBackfillMigration = readFileSync(vehicleBackfillMigrationPath, 'utf8');

    expect(vehicleColumnsMigration).toMatch(
      /CREATE FUNCTION "public"\."normalize_vehicle_registration_number"/,
    );
    expect(vehicleColumnsMigration).toContain('ADD COLUMN "rangePriceMinor" BIGINT');
    expect(vehicleColumnsMigration).toMatch(/CREATE FUNCTION "public"\."normalize_vehicle_vin"/);
    expect(vehicleColumnsMigration).toContain(
      "translate(upper(value), 'ABCEHKMOPTXY', 'АВСЕНКМОРТХУ')",
    );
    expect(vehicleColumnsMigration).toMatch(/CREATE TRIGGER "Vehicle_normalize_legal_identifiers"/);
    expect(vehicleColumnsMigration).toMatch(
      /BEFORE INSERT OR UPDATE OF "registrationNumber", "vin"/,
    );
    expect(vehicleColumnsMigration).toMatch(/SET LOCAL lock_timeout/);
    expect(vehicleColumnsMigration).toMatch(/SET LOCAL statement_timeout/);
    expect(vehicleColumnsMigration).not.toContain('CREATE TABLE "public"."Rental"');
    expect(vehicleBackfillMigration).toMatch(
      /UPDATE "public"\."Vehicle"[\s\S]*"registrationNumberNormalized"/,
    );
    expect(vehicleBackfillMigration).toMatch(
      /"vinNormalized" = "public"\."normalize_vehicle_vin"\("vin"\)/,
    );
    expect(vehicleBackfillMigration).toMatch(/duplicate normalized registration numbers/);
    expect(vehicleBackfillMigration).toMatch(/duplicate VIN values/);

    expect(vehicleBackfillMigration).toContain('GROUP BY "companyId", "vinNormalized"');
    expect(vehicleColumnsMigration).toContain("SELECT NULLIF(upper(btrim(value)), '');");
    expect(vehicleBackfillMigration).not.toMatch(/^\s*(DELETE|TRUNCATE)\b/im);
  });

  it('uses exactly the same Latin-to-Cyrillic plate mapping in TypeScript and SQL', () => {
    expect(Object.entries(registrationNumberHomoglyphs)).toEqual(plateHomoglyphMapping);

    const vehicleColumnsMigration = readFileSync(vehicleColumnsMigrationPath, 'utf8');
    expect(vehicleColumnsMigration).toContain(
      "translate(upper(value), 'ABCEHKMOPTXY', 'АВСЕНКМОРТХУ')",
    );
    expect(vehicleColumnsMigration).toContain('"normalize_vehicle_registration_number"');
    expect(readFileSync(vehicleBackfillMigrationPath, 'utf8')).toContain(
      '"normalize_vehicle_registration_number"("registrationNumber")',
    );
    expect(readFileSync(concurrentIndexMigrationPaths[1], 'utf8')).toContain(
      '"registrationNumberNormalized"',
    );
  });

  it('enforces rental lifecycle, version, document-category, and calculation invariants in SQL', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    for (const constraint of [
      'Rental_snapshotVersion_positive_check',
      'Rental_lifecycle_check',
      'Rental_calculation_check',
      'RentalDriver_sortOrder_non_negative_check',
      'ContractTemplateVersion_version_positive_check',
      'ContractTemplateVersion_publishedAt_check',
      'RentalDocumentVersion_version_positive_check',
      'RentalDocumentVersion_contract_category_check',
      'RentalDocumentVersion_format_matches_client_version_check',
      'RentalDocumentVersion_clientDocumentVersionId_key',
      'ContractTemplateVersion_prevent_published_mutation',
      'Rental_prevent_legal_snapshot_mutation',
      'ClientDocument_prevent_rental_category_mutation',
      'ClientDocumentVersion_prevent_rental_mime_mutation',
    ]) {
      expect(migration).toContain(constraint);
    }

    expect(migration).toContain('NULLIF(btrim("priceOverrideReason"), \'\') IS NOT NULL');
    expect(migration).toContain(
      '"dailyRateMinor"::numeric * "billableDays"::numeric = "basePriceMinor"::numeric',
    );
    expect(migration).toContain(
      '"totalPriceMinor"::numeric = "basePriceMinor"::numeric - "discountMinor"::numeric + "servicesMinor"::numeric',
    );
    expect(migration).toContain(
      "OLD.\"status\" = 'DRAFT' AND NEW.\"status\" IN ('DRAFT', 'CONFIRMED', 'CANCELLED')",
    );
    expect(migration).toContain(
      "OLD.\"status\" = 'CONFIRMED' AND NEW.\"status\" IN ('CONFIRMED', 'ACTIVE', 'CANCELLED')",
    );
    expect(migration).toContain(
      "OLD.\"status\" = 'ACTIVE' AND NEW.\"status\" IN ('ACTIVE', 'COMPLETED', 'CANCELLED')",
    );
    expect(migration).toContain('IF OLD."confirmedAt" IS NOT NULL AND (');
    expect(migration).toContain('OR NEW."dailyRateMinor" IS DISTINCT FROM OLD."dailyRateMinor"');
    expect(migration).toContain('OR NEW."totalPriceMinor" IS DISTINCT FROM OLD."totalPriceMinor"');
    expect(migration).toContain('OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"');
    expect(migration).toContain('OR NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt"');
    expect(migration).toContain('OLD."status" = \'CONFIRMED\' AND NEW."status" = \'ACTIVE\'');
    expect(migration).toContain('OLD."status" = \'ACTIVE\' AND NEW."status" = \'COMPLETED\'');
    expect(migration).toContain(
      "OLD.\"status\" IN ('CONFIRMED', 'ACTIVE') AND NEW.\"status\" = 'CANCELLED'",
    );
  });

  it('uses one-statement Prisma-deploy-compatible concurrent migrations and a later FK wave', () => {
    expect(concurrentIndexMigrationPaths).toHaveLength(6);
    for (const path of concurrentIndexMigrationPaths) {
      expect(existsSync(path)).toBe(true);
      const sql = readFileSync(path, 'utf8')
        .replace(/^--.*$/gm, '')
        .trim();
      expect(sql).toMatch(/^CREATE (UNIQUE )?INDEX CONCURRENTLY [\s\S]+;$/);
      expect(sql.match(/CREATE (UNIQUE )?INDEX CONCURRENTLY/g)).toHaveLength(1);
      expect(sql).not.toMatch(/\b(BEGIN|COMMIT|DO|SET|ALTER|CREATE TABLE)\b/);
    }
    expect(readFileSync(concurrentIndexMigrationPaths[2], 'utf8')).toContain(
      '"Vehicle_companyId_vinNormalized_key"',
    );
    expect(readFileSync(concurrentIndexMigrationPaths[4], 'utf8')).toContain(
      '"ClientDocument_companyId_clientId_id_key"',
    );
    expect(readFileSync(foreignKeysMigrationPath, 'utf8')).toContain(
      'Rental_companyId_clientId_fkey',
    );
    const foreignKeysMigration = readFileSync(foreignKeysMigrationPath, 'utf8');
    expect(foreignKeysMigration).toContain(
      'Vehicle_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId")',
    );
    expect(foreignKeysMigration).toContain('NOT VALID');
    expect(existsSync(foreignKeyValidationMigrationPath)).toBe(true);
    expect(readFileSync(foreignKeyValidationMigrationPath, 'utf8')).toContain(
      'VALIDATE CONSTRAINT "Vehicle_archivedByUserId_fkey"',
    );
    expect(readFileSync(foreignKeyValidationMigrationPath, 'utf8')).toContain(
      'SET LOCAL lock_timeout',
    );

    expect(existsSync(migrationRecoveryRunbookPath)).toBe(true);
    const runbook = readFileSync(migrationRecoveryRunbookPath, 'utf8');
    expect(runbook).toContain('pg_index');
    expect(runbook).toContain('indisvalid');
    expect(runbook).toContain('indisready');
    expect(runbook).toContain('pg_get_indexdef');
    expect(runbook).toContain('DROP INDEX CONCURRENTLY IF EXISTS');
    expect(runbook).toContain('public."<index_name>"');
    expect(runbook).toContain('npx prisma migrate resolve --applied <migration_name>');
    expect(runbook).toContain('npx prisma migrate resolve --rolled-back <migration_name>');
    expect(runbook).toContain('npx prisma migrate deploy');
    expect(runbook).toContain('STOP/manual DBA');
  });

  it('models the populated-row guards: VIN canonicalization and non-override calculation reject invalid legacy values', () => {
    expect(normalizeVin('VIN123')).toBe('VIN123');
    expect(normalizeVin('vin123')).toBe('VIN123');
    expect(normalizeVin('  vin123  ')).toBe('VIN123');

    expect(
      calculationPermits({
        dailyRateMinor: BigInt(1000),
        billableDays: 4,
        basePriceMinor: BigInt(2000),
        discountMinor: BigInt(0),
        servicesMinor: BigInt(0),
        totalPriceMinor: BigInt(2000),
        priceOverrideReason: null,
      }),
    ).toBe(false);
    expect(
      calculationPermits({
        dailyRateMinor: BigInt(1000),
        billableDays: 4,
        basePriceMinor: BigInt(2000),
        discountMinor: BigInt(0),
        servicesMinor: BigInt(0),
        totalPriceMinor: BigInt(2000),
        priceOverrideReason: 'manual discount programme',
      }),
    ).toBe(true);
  });
});
