interface SchedulerRepository {
  telematicsIntegration: {
    findMany(args: unknown): Promise<Array<{ companyId: string }>>;
  };
}

export interface GlonassSoftSchedulerOptions {
  serviceUrl: string;
  serviceToken: string;
}

function syncUrl(value: string): URL {
  const base = new URL(value);
  const loopback = base.hostname === '127.0.0.1' || base.hostname === 'localhost';
  if (base.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && loopback)) {
    throw new Error('Некорректный адрес сервиса телеметрии.');
  }
  base.pathname = '/api/internal/telematics/glonasssoft/sync';
  base.search = '';
  base.hash = '';
  return base;
}

export async function runGlonassSoftScheduler(
  options: GlonassSoftSchedulerOptions,
  repository: SchedulerRepository,
  fetchImpl: typeof fetch = fetch,
  log: (message: string) => void = console.info,
): Promise<{ companies: number; succeeded: number; failed: number }> {
  if (options.serviceToken.length < 16) {
    throw new Error('Служебный токен телеметрии не настроен.');
  }
  const url = syncUrl(options.serviceUrl);
  const integrations = await repository.telematicsIntegration.findMany({
    where: { provider: 'GLONASSSOFT', enabled: true },
    select: { companyId: true },
    orderBy: { companyId: 'asc' },
    take: 100,
  });

  let succeeded = 0;
  let failed = 0;
  for (const integration of integrations) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.serviceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyId: integration.companyId }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      succeeded += 1;
      log(`GLONASSSOFT_SYNC_OK company=${integration.companyId}`);
    } catch {
      failed += 1;
      log(`GLONASSSOFT_SYNC_ERROR company=${integration.companyId}`);
    }
  }

  return { companies: integrations.length, succeeded, failed };
}
