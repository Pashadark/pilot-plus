import 'server-only';

import { createClient } from 'redis';

type PilotRedisClient = ReturnType<typeof createClient>;

let client: PilotRedisClient | null = null;

function redisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST ?? (process.env.NODE_ENV === 'production' ? '' : '127.0.0.1');
  const port = process.env.REDIS_PORT ?? (process.env.NODE_ENV === 'production' ? '' : '6379');
  if (!host || !port || !/^\d{1,5}$/u.test(port)) throw new Error('REDIS_NOT_CONFIGURED');
  return `redis://${host}:${port}`;
}

export async function getRedisClient(): Promise<PilotRedisClient> {
  if (!client) {
    client = createClient({
      url: redisUrl(),
      socket: { connectTimeout: 5_000, reconnectStrategy: false },
    });
    client.on('error', () => undefined);
  }
  if (!client.isOpen) await client.connect();
  return client;
}

export async function closeRedisClient(): Promise<void> {
  const current = client;
  client = null;
  if (current?.isOpen) await current.quit();
}

export async function createRedisSubscriber(): Promise<PilotRedisClient> {
  const subscriber = createClient({
    url: redisUrl(),
    socket: { connectTimeout: 5_000, reconnectStrategy: false },
  });
  subscriber.on('error', () => undefined);
  await subscriber.connect();
  return subscriber;
}
