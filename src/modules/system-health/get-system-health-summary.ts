import 'server-only';

import { unstable_cache } from 'next/cache';

import { getOperationalHealth } from './get-operational-health';
import { getSystemHealth } from './get-system-health';
import type { ServiceHealth, SystemHealthSummary } from './types';

const SUMMARY_REVALIDATE_SECONDS = 30;

type CacheSummary = (
  loader: () => Promise<SystemHealthSummary>,
  keyParts: string[],
  options: { revalidate: number },
) => () => Promise<SystemHealthSummary>;

interface SummarizableHealth {
  status: ServiceHealth['status'] | 'degraded';
  checkedAt: string;
}

export function summarizeSystemHealth(
  services: readonly SummarizableHealth[],
): SystemHealthSummary {
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

  return { state, count, total: services.length, checkedAt };
}

export function createCachedSystemHealthSummary(
  cacheSummary: CacheSummary,
  checkHealth: () => Promise<ServiceHealth[]>,
  checkOperations: () => Promise<SummarizableHealth[]> = async () => [],
) {
  return cacheSummary(
    async () => {
      const [services, operations] = await Promise.all([checkHealth(), checkOperations()]);
      return summarizeSystemHealth([...services, ...operations]);
    },
    ['pilot-system-health-summary'],
    // Короткий TTL ограничивает повторные DB/TCP probes между серверными рендерами shell.
    { revalidate: SUMMARY_REVALIDATE_SECONDS },
  );
}

export const getCachedSystemHealthSummary = createCachedSystemHealthSummary(
  unstable_cache,
  getSystemHealth,
  getOperationalHealth,
);
