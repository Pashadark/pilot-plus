import type { LivePositionEvent } from '../live-position-events';

interface LiveWorkerOptions {
  intervalMs: number;
  signal: AbortSignal;
}

interface SyncResult {
  requested: number;
  saved: number;
  skipped: number;
  changedVehicleIds: string[];
}

interface LiveWorkerDependencies {
  listCompanies(): Promise<Array<{ companyId: string }>>;
  sync(companyId: string): Promise<SyncResult>;
  publish(event: LivePositionEvent): Promise<unknown>;
  delay(milliseconds: number, signal: AbortSignal): Promise<unknown>;
  now(): number;
  log?(message: string): void;
}

export async function runLiveWorker(
  options: LiveWorkerOptions,
  dependencies: LiveWorkerDependencies,
): Promise<void> {
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 500) {
    throw new Error('INVALID_LIVE_WORKER_INTERVAL');
  }
  const log = dependencies.log ?? console.info;
  while (!options.signal.aborted) {
    const startedAt = dependencies.now();
    const companies = await dependencies.listCompanies();
    for (const { companyId } of companies) {
      if (options.signal.aborted) break;
      try {
        const result = await dependencies.sync(companyId);
        if (result.changedVehicleIds.length > 0) {
          await dependencies.publish({
            companyId,
            vehicleIds: result.changedVehicleIds,
            emittedAt: new Date().toISOString(),
          });
        }
        log(
          `GLONASSSOFT_LIVE_OK company=${companyId} requested=${result.requested} saved=${result.saved}`,
        );
      } catch (error) {
        log(`GLONASSSOFT_LIVE_ERROR company=${companyId} code=${safeCode(error)}`);
      }
    }
    if (options.signal.aborted) break;
    const remaining = Math.max(0, options.intervalMs - (dependencies.now() - startedAt));
    if (remaining > 0) await dependencies.delay(remaining, options.signal);
  }
}

function safeCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z][A-Z0-9_]{1,63}$/u.test(error.code)
  ) {
    return error.code;
  }
  return 'UNAVAILABLE';
}
