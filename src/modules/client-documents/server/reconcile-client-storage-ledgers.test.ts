import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('reconcileClientStorageLedgers', () => {
  it('общие модули восстановления доступны из Node CLI без Next.js server-only', async () => {
    const files = [
      new URL('./reconcile-client-storage-ledgers.ts', import.meta.url),
      new URL('../scan-upload.ts', import.meta.url),
      new URL('./upload-resource-controls.ts', import.meta.url),
      new URL('../../../services/malware-scanner/clamav-client.ts', import.meta.url),
    ];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source).not.toContain("import 'server-only'");
    }
  });
});
