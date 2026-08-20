import { expect, it, vi } from 'vitest';

import { runGlonassSoftScheduler } from './scheduler';

it('синхронизирует только включённые компании ограниченно и не пишет токен', async () => {
  const findMany = vi
    .fn()
    .mockResolvedValue([{ companyId: 'company-a' }, { companyId: 'company-b' }]);
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ saved: 10 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ saved: 8 }), { status: 200 }));
  const log = vi.fn();

  const result = await runGlonassSoftScheduler(
    {
      serviceUrl: 'http://127.0.0.1:3000',
      serviceToken: 'never-log-this-token',
    },
    { telematicsIntegration: { findMany } } as never,
    fetchImpl,
    log,
  );

  expect(result).toEqual({ companies: 2, succeeded: 2, failed: 0 });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl.mock.calls[0]?.[1]).toEqual(
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer never-log-this-token' }),
      body: JSON.stringify({ companyId: 'company-a' }),
    }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain('never-log-this-token');
});

it('fail closed без служебного токена', async () => {
  await expect(
    runGlonassSoftScheduler(
      { serviceUrl: 'http://127.0.0.1:3000', serviceToken: '' },
      { telematicsIntegration: { findMany: vi.fn() } } as never,
      vi.fn(),
      vi.fn(),
    ),
  ).rejects.toThrow('Служебный токен телеметрии не настроен.');
});
