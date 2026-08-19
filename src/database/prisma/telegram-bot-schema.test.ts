import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');
const migrationUrl = new URL(
  './migrations/20260819120000_add_telegram_bot_mvp/migration.sql',
  import.meta.url,
);

describe('Telegram bot MVP schema', () => {
  it('adds tenant-scoped identity, invite, rental request and notification lifecycles', () => {
    expect(schema).toContain('enum TelegramIdentityKind {');
    expect(schema).toContain('model TelegramIdentity {');
    expect(schema).toContain('telegramUserId String');
    expect(schema).toContain('@@unique([companyId, telegramUserId])');
    expect(schema).toContain('model TelegramInvite {');
    expect(schema).toMatch(/tokenHash\s+String\s+@unique/u);
    expect(schema).toContain('model BotRentalRequest {');
    expect(schema).toMatch(/idempotencyKey\s+String/u);
    expect(schema).toContain('@@unique([companyId, idempotencyKey])');
    expect(schema).toContain('model BotNotificationJob {');
    expect(schema).toMatch(/claimToken\s+String\?\s+@unique/u);
    expect(schema).toMatch(/scheduledEndsAt\s+DateTime\?/u);
  });

  it('ships an additive migration with identity ownership and request-shape constraints', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    const migration = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8') : '';

    expect(migration).toContain('CREATE TABLE "TelegramIdentity"');
    expect(migration).toContain(
      'CHECK (("userId" IS NOT NULL)::int + ("clientId" IS NOT NULL)::int = 1)',
    );
    expect(migration).toContain(
      'CHECK (("fulfillmentMode" = \'DELIVERY\') = ("deliveryAddressEncrypted" IS NOT NULL))',
    );
    expect(migration).toContain('CHECK ("startsAt" < "endsAt")');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/iu);
  });
});
