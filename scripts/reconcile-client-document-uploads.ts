import { prisma } from '../src/database/prisma/client';
import { reconcileStaleClientDocumentUploads } from '../src/modules/client-documents/server/reconcile-stale-uploads';
import { reconcileStaleClientPhotoUploads } from '../src/modules/client-documents/server/reconcile-stale-photo-uploads';
import { safeReconciliationFailureMessage } from '../src/modules/client-documents/server/recovery-policy';

async function main() {
  const result = await reconcileStaleClientDocumentUploads();
  const photos = await reconcileStaleClientPhotoUploads();
  console.log(
    `Reconciliation документов: восстановлено ${result.recovered}, ожидают очистки ${result.cleanupPending}, удалено устаревших quarantine-файлов ${result.staleFilesRemoved}.`,
  );
  console.log(
    `Reconciliation фото: обработано ${photos.reconciled}, ожидают очистки ${photos.cleanupPending}.`,
  );
  if (result.cleanupPending > 0 || photos.cleanupPending > 0) process.exitCode = 2;
  if (result.hasMore || photos.hasMore) {
    console.error('Остались необработанные строки: повторите команду.');
    process.exitCode = 2;
  }
}

main()
  .catch((error: unknown) => {
    console.error(safeReconciliationFailureMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
