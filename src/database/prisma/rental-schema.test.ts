import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');
const migrationPath = new URL(
  './migrations/20260813090000_add_rentals_and_vehicle_legal_fields/migration.sql',
  import.meta.url,
);

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
    expect(schema).toContain('@@unique([companyId, vin])');
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
  });

  it('фиксирует rental-документ в tenant-scoped истории CONTRACT без дублирования метаданных файла', () => {
    const rentalDocumentModel =
      schema.match(/model RentalDocumentVersion \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(rentalDocumentModel).toMatch(/companyId\s+String/);
    expect(rentalDocumentModel).toMatch(/clientId\s+String/);
    expect(rentalDocumentModel).toMatch(/clientDocumentId\s+String/);
    expect(rentalDocumentModel).toMatch(/clientDocumentVersionId\s+String/);
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
    expect(vehicleModel).toMatch(/depositMinor\s+BigInt\?/);
    expect(schema).toMatch(/lessorBirthDate\s+DateTime\?\s+@db\.Date/);
  });

  it('stages populated legacy vehicle data before tenant uniqueness and keeps old writers normalized', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/CREATE FUNCTION "public"\."normalize_vehicle_registration_number"/);
    expect(migration).toMatch(/UPDATE "public"\."Vehicle"[\s\S]*"registrationNumberNormalized"/);
    expect(migration).toMatch(/duplicate normalized registration numbers/);
    expect(migration).toMatch(/duplicate VIN values/);
    expect(migration).toMatch(/CREATE TRIGGER "Vehicle_normalize_registration_number"/);
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE OF "registrationNumber"/);
    expect(migration).toMatch(/SET LOCAL lock_timeout/);
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "Vehicle_companyId_registrationNumberNormalized_key"/,
    );

    const trigger = migration.indexOf('CREATE TRIGGER "Vehicle_normalize_registration_number"');
    const backfill = migration.indexOf('UPDATE "public"."Vehicle"');
    const duplicatePreflight = migration.indexOf('duplicate normalized registration numbers');
    const uniqueIndex = migration.indexOf(
      'CREATE UNIQUE INDEX "Vehicle_companyId_registrationNumberNormalized_key"',
    );

    expect(trigger).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(trigger);
    expect(duplicatePreflight).toBeGreaterThan(backfill);
    expect(uniqueIndex).toBeGreaterThan(duplicatePreflight);
    expect(migration).toContain('GROUP BY "companyId", upper(btrim("vin"))');
    expect(migration).not.toMatch(/^\s*(DELETE|TRUNCATE)\b/im);
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
    ]) {
      expect(migration).toContain(constraint);
    }
  });
});
