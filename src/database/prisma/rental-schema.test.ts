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
    expect(schema).toMatch(/dailyRateMinor\s+Int/);
    expect(schema).toMatch(/totalPriceMinor\s+Int/);
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
    expect(schema).toMatch(/clientDocumentVersionId\s+String\?\s+@unique/);
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
    expect(migration).toContain(`tsrange("startsAt", "endsAt", '[)')`);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
    expect(migration).not.toMatch(/^\s*UPDATE\b/im);
    expect(migration).not.toContain('SET NOT NULL');
  });
});
