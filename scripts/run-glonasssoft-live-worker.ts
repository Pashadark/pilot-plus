import { prisma } from '../src/database/prisma/client';
import { runLiveWorker } from '../src/modules/telematics/glonasssoft/live-worker';
import { createGlonassSoftClientRegistry } from '../src/modules/telematics/glonasssoft/client-registry';
import { syncCompanyLatestPositions } from '../src/modules/telematics/glonasssoft/sync-company.server';
import { publishLivePositionEvent } from '../src/modules/telematics/live-position-events';
import { closeRedisClient, getRedisClient } from '../src/services/redis/client.server';

const controller = new AbortController();
const clientRegistry = createGlonassSoftClientRegistry();
process.once('SIGINT', () => controller.abort());
process.once('SIGTERM', () => controller.abort());

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

runLiveWorker(
  { intervalMs: 2_000, signal: controller.signal },
  {
    listCompanies: () =>
      prisma.telematicsIntegration.findMany({
        where: { provider: 'GLONASSSOFT', enabled: true },
        select: { companyId: true },
        orderBy: { companyId: 'asc' },
        take: 100,
      }),
    sync: (companyId) =>
      syncCompanyLatestPositions(companyId, {
        createClient: (configuration) => clientRegistry.get(companyId, configuration),
      }),
    publish: async (event) => publishLivePositionEvent(event, await getRedisClient()),
    delay,
    now: Date.now,
  },
)
  .catch((error: unknown) => {
    console.error(
      error instanceof Error && /^[A-Z][A-Z0-9_]{1,63}$/u.test(error.message)
        ? error.message
        : 'GLONASSSOFT_LIVE_FATAL',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([prisma.$disconnect(), closeRedisClient()]);
  });
