import { prisma } from '../src/database/prisma/client';
import { reconcileStaleClientDocumentUploads } from '../src/modules/client-documents/server/reconcile-stale-uploads';
import { safeReconciliationFailureMessage } from '../src/modules/client-documents/server/recovery-policy';

async function main() {
  const result = await reconcileStaleClientDocumentUploads();
  console.log(
    `Reconciliation документов: восстановлено ${result.recovered}, ожидают очистки ${result.cleanupPending}, удалено устаревших quarantine-файлов ${result.staleFilesRemoved}.`,
  );
  if (result.cleanupPending > 0) process.exitCode = 2;
}

main()
  .catch((error: unknown) => {
    console.error(safeReconciliationFailureMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
