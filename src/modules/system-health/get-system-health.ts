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

export function createSystemHealthChecker({
  checkDatabase,
  checkTcp,
  environment,
}: SystemHealthDependencies) {
  return async function getSystemHealth(): Promise<ServiceHealth[]> {
    const [postgresql, redis, mqtt] = await Promise.all([
      checkDatabase(),
      checkTcp(serviceConfig(environment, 'redis')),
      checkTcp(serviceConfig(environment, 'mqtt')),
    ]);

    return [
      present('postgresql', 'PostgreSQL', postgresql),
      present('redis', 'Redis', redis),
      present('mqtt', 'MQTT', mqtt),
    ];
  };
}

export const getSystemHealth = createSystemHealthChecker({
  checkDatabase: checkPostgresql,
  checkTcp: checkTcpService,
  environment: process.env,
});
