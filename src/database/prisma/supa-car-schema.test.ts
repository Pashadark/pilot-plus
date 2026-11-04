import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');
const migrationPath = new URL(
  './migrations/20261014120000_add_supa_car_owner_core/migration.sql',
  import.meta.url,
);

function model(name: string): string {
  return schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`, 'u'))?.[0] ?? '';
}

describe('ядро SUPA CAR', () => {
  it('описывает отдельный профиль владельца с уникальным нормализованным телефоном', () => {
    const owner = model('OwnerProfile');

    expect(schema).toContain('enum OwnerProfileStatus {');
    expect(owner).toMatch(/companyId\s+String/u);
    expect(owner).toMatch(/phoneE164\s+String\s+@unique/u);
    expect(owner).toMatch(/passwordHash\s+String/u);
    expect(owner).toMatch(/status\s+OwnerProfileStatus\s+@default\(ACTIVE\)/u);
    expect(owner).toContain('sessions');
    expect(owner).toContain('vehicleAccess');
    expect(owner).toContain('ledgerEntries');
  });

  it('хранит только хэш refresh-токена и позволяет отзывать мобильную сессию', () => {
    const session = model('OwnerSession');

    expect(session).toMatch(/refreshTokenHash\s+String\s+@unique/u);
    expect(session).toMatch(/expiresAt\s+DateTime/u);
    expect(session).toMatch(/revokedAt\s+DateTime\?/u);
    expect(session).not.toMatch(/refreshToken\s+String/u);
  });

  it('ограничивает доступ владельца периодом назначения автомобиля', () => {
    const access = model('OwnerVehicleAccess');

    expect(access).toMatch(/ownerProfileId\s+String/u);
    expect(access).toMatch(/vehicleId\s+String/u);
    expect(access).toMatch(/startsAt\s+DateTime/u);
    expect(access).toMatch(/endsAt\s+DateTime\?/u);
    expect(access).toContain('@@unique([ownerProfileId, vehicleId, startsAt])');
    expect(access).toContain('@@index([ownerProfileId, startsAt, endsAt])');
  });

  it('сохраняет ставку 40 процентов и неизменяемые денежные проводки', () => {
    const rule = model('OwnerRevenueRule');
    const entry = model('OwnerLedgerEntry');

    expect(schema).toContain('enum OwnerLedgerEntryKind {');
    expect(rule).toMatch(/shareBasisPoints\s+Int\s+@default\(4000\)/u);
    expect(entry).toMatch(/amountMinor\s+BigInt/u);
    expect(entry).toMatch(/shareBasisPoints\s+Int/u);
    expect(entry).toMatch(/idempotencyKey\s+String\s+@unique/u);
    expect(entry).toMatch(/rentalPaymentId\s+String\?/u);
    expect(entry).not.toMatch(/updatedAt/u);
  });

  it('поставляется с SQL-миграцией для production', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });
});
