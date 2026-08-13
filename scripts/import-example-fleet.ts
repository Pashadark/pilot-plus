import { readFile } from 'node:fs/promises';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { applyFleetImport } from '@/modules/vehicles/manage/import/apply';
import { parseExampleFleetWorkbook } from '@/modules/vehicles/manage/import/parser';

const [filePath, companyId, actorUserId, actorEmail] = process.argv.slice(2);

if (!filePath || !companyId || !actorUserId || !actorEmail) {
  throw new Error(
    'Использование: tsx scripts/import-example-fleet.ts <file.xlsx> <companyId> <actorUserId> <actorEmail>',
  );
}

const parsed = parseExampleFleetWorkbook({
  filename: filePath,
  bytes: new Uint8Array(await readFile(filePath)),
});
if (parsed.errors.length > 0) throw new Error('Файл содержит ошибки строк; импорт не применён.');

const result = await applyFleetImport({
  companyId,
  actor: { id: actorUserId, email: actorEmail },
  rows: parsed.rows,
  archiveIds: [],
  transaction: (callback) =>
    prisma.$transaction(
      (transaction) => callback(transaction as unknown as Parameters<typeof callback>[0]),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
});

if (!result.ok) throw new Error(result.message);
console.log(JSON.stringify(result));
