import { describe, expect, it, vi } from 'vitest';

import { checkTcpService } from './check-service';
import { createSystemHealthChecker } from './get-system-health';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const healthy = {
  status: 'healthy' as const,
  latencyMs: 4,
  checkedAt: '2026-07-20T12:00:00.000Z',
};

describe('getSystemHealth', () => {
  it('запускает PostgreSQL, Redis и MQTT параллельно', async () => {
    const database = deferred<typeof healthy>();
    const redis = deferred<typeof healthy>();
    const mqtt = deferred<typeof healthy>();
    const checkDatabase = vi.fn(() => database.promise);
    const checkTcp = vi
      .fn()
      .mockImplementationOnce(() => redis.promise)
      .mockImplementationOnce(() => mqtt.promise);
    const getSystemHealth = createSystemHealthChecker({
      checkDatabase,
      checkTcp,
      environment: {
        NODE_ENV: 'production',
        REDIS_HOST: 'redis.internal',
        REDIS_PORT: '6379',
        MQTT_HOST: 'mqtt.internal',
        MQTT_PORT: '1883',
      },
    });

    const resultPromise = getSystemHealth();

    expect(checkDatabase).toHaveBeenCalledOnce();
    expect(checkTcp).toHaveBeenCalledTimes(2);
    database.resolve(healthy);
    redis.resolve(healthy);
    mqtt.resolve(healthy);

    await expect(resultPromise).resolves.toHaveLength(3);
  });

  it('сохраняет безопасный результат при частичной недоступности', async () => {
    const unavailable = { ...healthy, status: 'unavailable' as const };
    const checkTcp = vi
      .fn()
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce({ ...healthy, status: 'unconfigured' as const });
    const getSystemHealth = createSystemHealthChecker({
      checkDatabase: vi.fn().mockResolvedValue(healthy),
      checkTcp,
      environment: {
        NODE_ENV: 'production',
        REDIS_HOST: 'redis.internal',
        REDIS_PORT: '6379',
      },
    });

    const services = await getSystemHealth();

    expect(services).toEqual([
      expect.objectContaining({ key: 'postgresql', label: 'PostgreSQL', status: 'healthy' }),
      expect.objectContaining({ key: 'redis', label: 'Redis', status: 'unavailable' }),
      expect.objectContaining({ key: 'mqtt', label: 'MQTT', status: 'unconfigured' }),
    ]);
    expect(services[1]?.message).toBe('Сервис временно недоступен.');
    expect(JSON.stringify(services)).not.toContain('internal');
    for (const service of services) {
      expect(Object.keys(service).sort()).toEqual(
        ['checkedAt', 'key', 'label', 'latencyMs', 'message', 'status'].sort(),
      );
    }
  });

  it('использует localhost defaults только в development', async () => {
    const checkTcp = vi.fn().mockResolvedValue(healthy);
    const developmentHealth = createSystemHealthChecker({
      checkDatabase: vi.fn().mockResolvedValue(healthy),
      checkTcp,
      environment: { NODE_ENV: 'development' },
    });

    await developmentHealth();

    expect(checkTcp).toHaveBeenNthCalledWith(1, {
      host: '127.0.0.1',
      port: 6379,
      timeoutMs: 1_000,
    });
    expect(checkTcp).toHaveBeenNthCalledWith(2, {
      host: '127.0.0.1',
      port: 1883,
      timeoutMs: 1_000,
    });
  });

  it('в production без Redis/MQTT env передаёт пустую конфигурацию в реальную TCP-проверку', async () => {
    const checkTcp = vi.fn(checkTcpService);
    const productionHealth = createSystemHealthChecker({
      checkDatabase: vi.fn().mockResolvedValue(healthy),
      checkTcp,
      environment: { NODE_ENV: 'production' },
    });

    const services = await productionHealth();

    expect(checkTcp).toHaveBeenNthCalledWith(1, {
      host: undefined,
      port: undefined,
      timeoutMs: 1_000,
    });
    expect(checkTcp).toHaveBeenNthCalledWith(2, {
      host: undefined,
      port: undefined,
      timeoutMs: 1_000,
    });
    expect(services.map(({ key, status, latencyMs }) => ({ key, status, latencyMs }))).toEqual([
      { key: 'postgresql', status: 'healthy', latencyMs: 4 },
      { key: 'redis', status: 'unconfigured', latencyMs: 0 },
      { key: 'mqtt', status: 'unconfigured', latencyMs: 0 },
    ]);
  });
});
