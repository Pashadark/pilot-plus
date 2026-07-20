import { EventEmitter } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkTcpService } from './check-service';

const openServers = new Set<ReturnType<typeof createServer>>();

async function listen() {
  const server = createServer();
  openServers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, port: (server.address() as AddressInfo).port };
}

async function close(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  openServers.delete(server);
}

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all([...openServers].map(close));
});

describe('checkTcpService', () => {
  it('возвращает healthy для доступного TCP-сервиса', async () => {
    const { port } = await listen();

    const result = await checkTcpService({ host: '127.0.0.1', port, timeoutMs: 250 });

    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('возвращает unavailable для закрытого порта', async () => {
    const { server, port } = await listen();
    await close(server);

    const result = await checkTcpService({ host: '127.0.0.1', port, timeoutMs: 250 });

    expect(result.status).toBe('unavailable');
    expect(result).not.toHaveProperty('host');
    expect(result).not.toHaveProperty('port');
    expect(result).not.toHaveProperty('error');
  });

  it.each([
    { host: undefined, port: 6379 },
    { host: '127.0.0.1', port: undefined },
  ])('возвращает unconfigured при неполной конфигурации', async (config) => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(125);

    await expect(checkTcpService({ ...config, timeoutMs: 250 })).resolves.toMatchObject({
      status: 'unconfigured',
      latencyMs: 0,
    });
  });

  it('завершает зависшее подключение по таймауту и уничтожает сокет', async () => {
    vi.useFakeTimers();
    const socket = Object.assign(new EventEmitter(), {
      destroy: vi.fn(),
    });

    const resultPromise = checkTcpService(
      { host: '127.0.0.1', port: 6379, timeoutMs: 100 },
      () => socket,
    );
    await vi.advanceTimersByTimeAsync(100);

    await expect(resultPromise).resolves.toMatchObject({ status: 'unavailable' });
    expect(socket.destroy).toHaveBeenCalled();
  });
});
