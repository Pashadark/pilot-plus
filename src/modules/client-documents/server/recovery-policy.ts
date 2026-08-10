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

export function quarantineRetentionMs(
  value = process.env.CLIENT_DOCUMENT_QUARANTINE_RETENTION_HOURS,
) {
  const parsed = value ? Number.parseInt(value, 10) : 24;
  const hours = Number.isFinite(parsed) ? Math.min(7 * 24, Math.max(1, parsed)) : 24;
  return hours * 60 * 60_000;
}

export function maxQuarantineScanRetries(value = process.env.CLIENT_DOCUMENT_SCAN_RETRY_MAX) {
  const parsed = value ? Number.parseInt(value, 10) : 3;
  return Number.isFinite(parsed) ? Math.min(10, Math.max(0, parsed)) : 3;
}

export function scanRetryDelayMs(retryCount: number) {
  return Math.min(60 * 60_000, 5 * 60_000 * 2 ** Math.max(0, Math.min(10, retryCount)));
}

export function newQuarantineExpiresAt(now = new Date(), retentionMs = quarantineRetentionMs()) {
  return new Date(now.getTime() + retentionMs);
}

export function safeReconciliationFailureMessage(error: unknown) {
  void error;
  return 'Reconciliation документов не выполнен. Проверьте DATABASE_URL, PRIVATE_STORAGE_ROOT, права хранилища и доступность БД, затем повторите запуск.';
}
