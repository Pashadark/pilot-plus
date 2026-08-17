import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('./migrations/20260817120000_add_client_comments/migration.sql', import.meta.url),
  'utf8',
);

describe('схема внутренних комментариев клиента', () => {
  it('добавляет tenant-scoped soft-hide модель и аддитивную миграцию', () => {
    expect(schema).toContain('model ClientComment {');
    expect(schema).toContain('category       ClientCommentCategory');
    expect(schema).toContain('hiddenAt       DateTime?');
    expect(schema).toContain('@@index([companyId, clientId, isPinned, createdAt])');
    expect(migration).toContain('CREATE TABLE "ClientComment"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/iu);
  });
});
