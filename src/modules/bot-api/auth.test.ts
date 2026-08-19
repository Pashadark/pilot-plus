import { afterEach, describe, expect, it, vi } from 'vitest';

import { authenticateBotRequest } from './auth';

describe('authenticateBotRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects missing and incorrect service tokens', async () => {
    vi.stubEnv('PILOT_BOT_SERVICE_TOKEN', 'service-secret-with-enough-entropy');
    await expect(authenticateBotRequest(new Request('http://localhost'))).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    await expect(
      authenticateBotRequest(
        new Request('http://localhost', { headers: { authorization: 'Bearer incorrect' } }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('accepts the exact bearer token', async () => {
    vi.stubEnv('PILOT_BOT_SERVICE_TOKEN', 'service-secret-with-enough-entropy');
    await expect(
      authenticateBotRequest(
        new Request('http://localhost', {
          headers: { authorization: 'Bearer service-secret-with-enough-entropy' },
        }),
      ),
    ).resolves.toEqual({ service: 'TELEGRAM_BOT' });
  });
});
