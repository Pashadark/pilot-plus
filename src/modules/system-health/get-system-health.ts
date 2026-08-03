import 'server-only';

import { prisma } from '@/database/prisma/client';

import { checkTcpService } from './check-service';
import type { ServiceHealth, ServiceHealthStatus } from './types';

const SERVICE_TIMEOUT_MS = 1_000;

interface HealthEnvironment {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  MQTT_HOST?: string;
  MQTT_PORT?: string;
}

interface SystemHealthDependencies {
  checkApplication: () => Promise<ServiceHealthStatus>;
  checkDatabase: () => Promise<ServiceHealthStatus>;
  checkTcp: typeof checkTcpService;
  environment: HealthEnvironment;
}

function parsePort(value: string | undefined) {
  if (!value) return undefined;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : undefined;
}

function serviceConfig(
  environment: HealthEnvironment,
  service: 'redis' | 'mqtt',
): { host?: string; port?: number; timeoutMs: number } {
  const isDevelopment = environment.NODE_ENV === 'development';
  const hostKey = service === 'redis' ? 'REDIS_HOST' : 'MQTT_HOST';
  const portKey = service === 'redis' ? 'REDIS_PORT' : 'MQTT_PORT';
  const defaultPort = service === 'redis' ? 6379 : 1883;

  return {
    host: environment[hostKey] || (isDevelopment ? '127.0.0.1' : undefined),
    port: parsePort(environment[portKey]) ?? (isDevelopment ? defaultPort : undefined),
    timeoutMs: SERVICE_TIMEOUT_MS,
  };
}

const messages: Record<ServiceHealthStatus['status'], string> = {
  healthy: 'Сервис доступен.',
  unavailable: 'Сервис временно недоступен.',
  unconfigured: 'Сервис не настроен.',
};

function present(
  key: ServiceHealth['key'],
  label: string,
  status: ServiceHealthStatus,
): ServiceHealth {
  return {
    key,
    label,
    status: status.status,
    message: messages[status.status],
    latencyMs: status.latencyMs,
    checkedAt: status.checkedAt,
  };
}

function fallbackStatus(
  status: ServiceHealthStatus['status'],
  startedAt: number,
): ServiceHealthStatus {
  return {
    status,
    latencyMs: status === 'unconfigured' ? 0 : Math.min(SERVICE_TIMEOUT_MS, Date.now() - startedAt),
    checkedAt: new Date().toISOString(),
  };
}

async function checkPostgresql(): Promise<ServiceHealthStatus> {
  const startedAt = Date.now();
  if (!process.env.DATABASE_URL) {
    return {
      status: 'unconfigured',
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    await prisma.$queryRaw<Array<{ '?column?': number }>>`SELECT 1`;
    return {
      status: 'healthy',
      latencyMs: Math.max(0, Date.now() - startedAt),
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'unavailable',
      latencyMs: Math.max(0, Date.now() - startedAt),
      checkedAt: new Date().toISOString(),
    };
  }
}

async function checkApplication(): Promise<ServiceHealthStatus> {
  const startedAt = Date.now();

  try {
    const response = Response.json({ status: 'ok' });
    if (!response.ok) throw new Error('Не удалось сформировать ответ API.');
    return {
      status: 'healthy',
      latencyMs: Math.max(0, Date.now() - startedAt),
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'unavailable',
      latencyMs: Math.max(0, Date.now() - startedAt),
      checkedAt: new Date().toISOString(),
    };
  }
}

export function createSystemHealthChecker({
  checkApplication,
  checkDatabase,
  checkTcp,
  environment,
}: SystemHealthDependencies) {
  return async function getSystemHealth(): Promise<ServiceHealth[]> {
    const startedAt = Date.now();
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>((resolve) => {
      deadlineTimer = setTimeout(resolve, SERVICE_TIMEOUT_MS);
    });
    const redisConfig = serviceConfig(environment, 'redis');
    const mqttConfig = serviceConfig(environment, 'mqtt');

    const settleProbe = (
      probe: () => Promise<ServiceHealthStatus>,
      timeoutStatus: ServiceHealthStatus['status'],
    ) => {
      let probePromise: Promise<ServiceHealthStatus>;
      try {
        probePromise = probe();
      } catch {
        probePromise = Promise.resolve(fallbackStatus(timeoutStatus, startedAt));
      }

      return Promise.race([
        probePromise.catch(() => fallbackStatus(timeoutStatus, startedAt)),
        deadline.then(() => fallbackStatus(timeoutStatus, startedAt)),
      ]);
    };

    try {
      const [api, postgresql, redis, mqtt] = await Promise.all([
        settleProbe(checkApplication, 'unavailable'),
        settleProbe(checkDatabase, environment.DATABASE_URL ? 'unavailable' : 'unconfigured'),
        settleProbe(
          () => checkTcp(redisConfig),
          redisConfig.host && redisConfig.port ? 'unavailable' : 'unconfigured',
        ),
        settleProbe(
          () => checkTcp(mqttConfig),
          mqttConfig.host && mqttConfig.port ? 'unavailable' : 'unconfigured',
        ),
      ]);

      return [
        present('api', 'API Pilot+', api),
        present('postgresql', 'PostgreSQL', postgresql),
        present('redis', 'Redis', redis),
        present('mqtt', 'MQTT', mqtt),
      ];
    } finally {
      clearTimeout(deadlineTimer);
    }
  };
}

export const getSystemHealth = createSystemHealthChecker({
  checkApplication,
  checkDatabase: checkPostgresql,
  checkTcp: checkTcpService,
  environment: process.env,
});
