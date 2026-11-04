import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('uploaded media WebP preview schema', () => {
  it.each(['ClientDocumentVersion', 'RentalOperationMedia'])(
    'keeps preview metadata optional beside the canonical original on %s',
    async (modelName) => {
      const schema = await readFile(resolve('src/database/prisma/schema.prisma'), 'utf8');
      const model = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';

      expect(model).toContain('storageKey');
      expect(model).toMatch(/previewStorageKey\s+String\?\s+@unique/u);
      expect(model).toMatch(/previewMime\s+String\?/u);
      expect(model).toMatch(/previewBytes\s+Int\?/u);
      expect(model).toMatch(/previewSha256\s+String\?/u);
      expect(model).toMatch(/previewGeneratedAt\s+DateTime\?/u);
    },
  );

  it('uses an additive migration with unique preview keys', async () => {
    const migration = await readFile(
      resolve(
        'src/database/prisma/migrations/20261104120000_add_uploaded_media_webp_previews/migration.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('ALTER TABLE "ClientDocumentVersion"');
    expect(migration).toContain('ALTER TABLE "RentalOperationMedia"');
    expect(migration).toContain('ClientDocumentVersion_previewStorageKey_key');
    expect(migration).toContain('RentalOperationMedia_previewStorageKey_key');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/iu);
  });
});
