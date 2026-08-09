const defaultStaleUploadMinutes = 15;
const minimumStaleUploadMinutes = 5;
const maximumStaleUploadMinutes = 24 * 60;

export function staleUploadThresholdMs(value = process.env.CLIENT_DOCUMENT_STALE_UPLOAD_MINUTES) {
  const parsed = value ? Number.parseInt(value, 10) : defaultStaleUploadMinutes;
  const minutes = Number.isFinite(parsed)
    ? Math.min(maximumStaleUploadMinutes, Math.max(minimumStaleUploadMinutes, parsed))
    : defaultStaleUploadMinutes;
  return minutes * 60_000;
}

export function newScanLeaseExpiresAt(now = new Date(), thresholdMs = staleUploadThresholdMs()) {
  return new Date(now.getTime() + thresholdMs);
}

export function safeReconciliationFailureMessage(error: unknown) {
  void error;
  return 'Reconciliation документов не выполнен. Проверьте DATABASE_URL, PRIVATE_STORAGE_ROOT, права хранилища и доступность БД, затем повторите запуск.';
}
