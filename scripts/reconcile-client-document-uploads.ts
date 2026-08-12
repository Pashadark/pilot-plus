import { prisma } from '../src/database/prisma/client';
import { reconcileExpiredClientUploadPermits } from '../src/modules/client-documents/server/reconcile-expired-upload-permits';
import { reconcileClientStorageLedgers } from '../src/modules/client-documents/server/reconcile-client-storage-ledgers';
import { reconcileStaleClientDocumentUploads } from '../src/modules/client-documents/server/reconcile-stale-uploads';
import { reconcileStaleClientPhotoUploads } from '../src/modules/client-documents/server/reconcile-stale-photo-uploads';
import { safeReconciliationFailureMessage } from '../src/modules/client-documents/server/recovery-policy';

async function main() {
  const ledgers = await reconcileClientStorageLedgers();
  const result = await reconcileStaleClientDocumentUploads();
  const photos = await reconcileStaleClientPhotoUploads();
  const permits = await reconcileExpiredClientUploadPermits();
  console.log(`Reconciliation storage ledger: сверено ${ledgers.reconciled}.`);
  console.log(
    `Reconciliation документов: восстановлено ${result.recovered}, повторно проверено ${result.retried}, ожидают retry ${result.retryPending}, expired ${result.expired}, archive cleanup ${result.archivedCleaned}, ожидают очистки ${result.cleanupPending}, удалено устаревших quarantine-файлов ${result.staleFilesRemoved}.`,
  );
  console.log(
    `Reconciliation фото: обработано ${photos.reconciled}, ожидают очистки ${photos.cleanupPending}.`,
  );
  console.log(
    `Reconciliation permits: освобождено ${permits.released}, связаны с durable upload ${permits.linked}, ожидают очистки ${permits.cleanupPending}.`,
  );
  console.log(
    `CLIENT_DOCUMENT_RECONCILIATION_OK ${JSON.stringify({
      completedAt: new Date().toISOString(),
      documentCleanupPending: result.cleanupPending,
      photoCleanupPending: photos.cleanupPending,
      permitCleanupPending: permits.cleanupPending,
      retryPending: result.retryPending,
    })}`,
  );
  if (
    result.cleanupPending > 0 ||
    photos.cleanupPending > 0 ||
    permits.cleanupPending > 0 ||
    result.retryPending > 0
  ) {
    process.exitCode = 2;
  }
  if (ledgers.hasMore || result.hasMore || photos.hasMore || permits.hasMore) {
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
