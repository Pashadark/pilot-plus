import 'server-only';

import { unstable_cache } from 'next/cache';

import { getSystemHealth } from './get-system-health';
import type { ServiceHealth, SystemHealthSummary } from './types';

const SUMMARY_REVALIDATE_SECONDS = 30;

type CacheSummary = (
  loader: () => Promise<SystemHealthSummary>,
  keyParts: string[],
  options: { revalidate: number },
) => () => Promise<SystemHealthSummary>;

export function summarizeSystemHealth(services: readonly ServiceHealth[]): SystemHealthSummary {
  const count = services.filter((service) => service.status === 'healthy').length;
  const state =
    count === services.length && services.length > 0
      ? 'healthy'
      : count > 0
        ? 'degraded'
        : 'unavailable';
  const checkedAt = services.reduce(
    (latest, service) => (service.checkedAt > latest ? service.checkedAt : latest),
    '',
  );

  return { state, count, checkedAt };
}

export function createCachedSystemHealthSummary(
  cacheSummary: CacheSummary,
  checkHealth: () => Promise<ServiceHealth[]>,
) {
  return cacheSummary(
    async () => summarizeSystemHealth(await checkHealth()),
    ['pilot-system-health-summary'],
    // Короткий TTL ограничивает повторные DB/TCP probes между серверными рендерами shell.
    { revalidate: SUMMARY_REVALIDATE_SECONDS },
  );
}

export const getCachedSystemHealthSummary = createCachedSystemHealthSummary(
  unstable_cache,
  getSystemHealth,
);
