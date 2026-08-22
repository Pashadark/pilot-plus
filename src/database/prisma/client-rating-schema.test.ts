import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');
const migrationPath = new URL(
  './migrations/20260822120000_add_client_rating/migration.sql',
  import.meta.url,
);

describe('схема рейтинга надёжности клиента', () => {
  it('добавляет tenant-scoped неизменяемый журнал и поля проблемной заметки', () => {
    const ratingEvent = schema.match(/model ClientRatingEvent \{[\s\S]*?\n\}/)?.[0] ?? '';
    const clientComment = schema.match(/model ClientComment \{[\s\S]*?\n\}/)?.[0] ?? '';
    const companyMember = schema.match(/model CompanyMember \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(schema).toContain('enum ClientRatingEventSource {');
    expect(schema).toContain('enum ClientRatingEventType {');
    expect(schema).toContain('enum ClientRatingEventReason {');
    expect(schema).toContain('enum ClientCommentProblemStatus {');
    expect(schema).toContain('model ClientRatingEvent {');
    expect(ratingEvent).toMatch(/idempotencyKey\s+String\?\s+@unique/);
    expect(ratingEvent).toMatch(/commentId\s+String\?\s+@unique/);
    expect(ratingEvent).toMatch(/reason\s+ClientRatingEventReason/);
    expect(ratingEvent).not.toMatch(/description\s+String/);
    expect(ratingEvent).toContain('@@unique([companyId, commentId])');
    expect(ratingEvent).toMatch(
      /client\s+Client\s+@relation\(fields: \[companyId, clientId\], references: \[companyId, id\]/,
    );
    expect(ratingEvent).toMatch(
      /rental\s+Rental\?\s+@relation\(fields: \[companyId, rentalId\], references: \[companyId, id\]/,
    );
    expect(ratingEvent).toMatch(
      /fine\s+Fine\?\s+@relation\(fields: \[companyId, fineId\], references: \[companyId, id\]/,
    );
    expect(ratingEvent).toMatch(
      /vehicle\s+Vehicle\?\s+@relation\(fields: \[companyId, vehicleId\], references: \[companyId, id\]/,
    );
    expect(ratingEvent).toMatch(
      /comment\s+ClientComment\?\s+@relation\(fields: \[companyId, commentId\], references: \[companyId, id\]/,
    );
    expect(ratingEvent).toMatch(
      /actorMembership\s+CompanyMember\?\s+@relation\("ClientRatingEventActor", fields: \[companyId, actorUserId\], references: \[companyId, userId\]/,
    );
    expect(ratingEvent).toContain('@@index([companyId, clientId, createdAt])');

    expect(clientComment).toMatch(/problemStatus\s+ClientCommentProblemStatus\?/);
    expect(clientComment).toMatch(/resolvedAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
    expect(clientComment).toMatch(/resolvedByUserId\s+String\?/);
    expect(clientComment).toMatch(
      /resolvedByMembership\s+CompanyMember\?\s+@relation\("ClientCommentResolvedBy", fields: \[companyId, resolvedByUserId\], references: \[companyId, userId\]/,
    );
    expect(clientComment).toMatch(/affectsRating\s+Boolean\?/);
    expect(clientComment).toMatch(/ratingDelta\s+Int\?/);
    expect(clientComment).toContain('@@unique([companyId, id])');
    expect(companyMember).toMatch(/ratingEvents\s+ClientRatingEvent\[\]/);
    expect(companyMember).toMatch(/resolvedClientComments\s+ClientComment\[\]/);
  });

  it('ships additive SQL constraints, tenant foreign keys, and append-only protection', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE "ClientRatingEvent"');
    expect(migration).toContain('ClientRatingEvent_delta_range_check');
    expect(migration).toContain('CHECK ("delta" BETWEEN -50 AND 10)');
    expect(migration).toContain('ClientRatingEvent_companyId_clientId_fkey');
    expect(migration).toContain('ClientRatingEvent_companyId_rentalId_fkey');
    expect(migration).toContain('ClientRatingEvent_companyId_fineId_fkey');
    expect(migration).toContain('ClientRatingEvent_companyId_vehicleId_fkey');
    expect(migration).toContain('ClientRatingEvent_companyId_commentId_fkey');
    expect(migration).toContain('ClientRatingEvent_companyId_actorUserId_fkey');
    expect(migration).toContain('ClientComment_companyId_resolvedByUserId_fkey');
    expect(migration).toContain('FOREIGN KEY ("companyId", "actorUserId")');
    expect(migration).toContain('FOREIGN KEY ("companyId", "resolvedByUserId")');
    expect(migration).toContain('REFERENCES "CompanyMember"("companyId", "userId")');
    expect(migration).toContain('CREATE TYPE "ClientRatingEventReason"');
    expect(migration).toContain('"reason" "ClientRatingEventReason" NOT NULL');
    expect(migration).not.toMatch(/"description"\s+TEXT/);
    expect(migration).toContain('ClientRatingEvent_prevent_mutation');
    expect(migration).toMatch(/BEFORE UPDATE OR DELETE ON "ClientRatingEvent"/);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/iu);
  });

  it('rejects actor and resolver links from another company at the database boundary', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(
      /CONSTRAINT "ClientRatingEvent_companyId_actorUserId_fkey"\s+FOREIGN KEY \("companyId", "actorUserId"\) REFERENCES "CompanyMember"\("companyId", "userId"\)/,
    );
    expect(migration).toMatch(
      /CONSTRAINT "ClientComment_companyId_resolvedByUserId_fkey"\s+FOREIGN KEY \("companyId", "resolvedByUserId"\) REFERENCES "CompanyMember"\("companyId", "userId"\)/,
    );
    expect(migration).not.toContain('FOREIGN KEY ("actorUserId") REFERENCES "User"');
    expect(migration).not.toContain('FOREIGN KEY ("resolvedByUserId") REFERENCES "User"');
  });
});
