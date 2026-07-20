import 'server-only';

import { createConnection } from 'node:net';

import type { ServiceHealthStatus } from './types';

interface TcpServiceOptions {
  host?: string;
  port?: number;
  timeoutMs: number;
}

interface TcpSocket {
  destroy(): unknown;
  once(event: 'connect' | 'error', listener: () => void): unknown;
}

type ConnectTcp = (options: { host: string; port: number }) => TcpSocket;

function result(status: ServiceHealthStatus['status'], startedAt: number): ServiceHealthStatus {
  return {
    status,
    latencyMs: Math.max(0, Date.now() - startedAt),
    checkedAt: new Date().toISOString(),
  };
}

export async function checkTcpService(
  { host, port, timeoutMs }: TcpServiceOptions,
  connectTcp: ConnectTcp = createConnection,
): Promise<ServiceHealthStatus> {
  const startedAt = Date.now();
  if (!host || !port) {
    return {
      status: 'unconfigured',
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  const socket = connectTcp({ host, port });

  try {
    const status = await new Promise<ServiceHealthStatus['status']>((resolve) => {
      const timer = setTimeout(() => resolve('unavailable'), timeoutMs);
      const finish = (nextStatus: ServiceHealthStatus['status']) => {
        clearTimeout(timer);
        resolve(nextStatus);
      };

      socket.once('connect', () => finish('healthy'));
      socket.once('error', () => finish('unavailable'));
    });

    return result(status, startedAt);
  } finally {
    socket.destroy();
  }
}
