import 'server-only';

interface E2EErrorSeamEnvironment {
  NODE_ENV?: string;
  PILOT_E2E_ERROR_SEAM?: string;
}

const globalForErrorSeam = globalThis as typeof globalThis & {
  pilotE2EFailedErrorIds?: Set<string>;
};

function failedErrorIds() {
  globalForErrorSeam.pilotE2EFailedErrorIds ??= new Set<string>();
  return globalForErrorSeam.pilotE2EFailedErrorIds;
}

export function isE2EErrorSeamEnabled(environment: E2EErrorSeamEnvironment): boolean {
  return environment.NODE_ENV !== 'production' && environment.PILOT_E2E_ERROR_SEAM === '1';
}

export function isValidE2EErrorId(value: string | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(value);
}

export function triggerE2EErrorOnce(id: string): void {
  const failedIds = failedErrorIds();
  if (failedIds.has(id)) return;

  if (failedIds.size >= 1_000) failedIds.clear();
  failedIds.add(id);
  throw new Error('PILOT_E2E_PROTECTED_BOUNDARY');
}
