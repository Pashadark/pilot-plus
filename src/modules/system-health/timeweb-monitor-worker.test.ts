import { describe, expect, it, vi } from 'vitest';

import type { TimewebMonitorSnapshot } from './timeweb-monitor';
import { requestTimewebJson, runTimewebMonitor } from './timeweb-monitor-worker';

const now = new Date('2026-10-07T09:00:00.000Z');
const financeResponse = {
  finances: {
    balance: 2_450,
    currency: 'RUB',
    hourly_cost: 14.5,
    monthly_cost: 10_440,
    hours_left: 160,
    discount_percent: 0,
    autopay_card_info: null,
  },
};
const serverResponse = {
  servers: [{ id: 42, name: 'Mysterious Lacerta', status: 'on' }],
};

function fixture(previous: TimewebMonitorSnapshot | null = null) {
  const request = vi.fn(async (path: string) =>
    path.endsWith('/account/finances') ? financeResponse : serverResponse,
  );
  const writeSnapshot = vi.fn(async () => undefined);
  const enqueue = vi.fn(async () => ({ count: 1 }));
  return {
    request,
    writeSnapshot,
    enqueue,
    dependencies: {
      now: () => now,
      request,
      readSnapshot: vi.fn(async () => previous),
      writeSnapshot,
      findGroup: vi.fn<() => Promise<{ telegramChatId: string } | null>>(async () => ({
        telegramChatId: '-100777',
      })),
      enqueue,
    },
  };
}

describe('Timeweb monitor worker', () => {
  it('uses a bounded authenticated GET request without exposing the token in errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(
      requestTimewebJson('https://example.test', 'secret-token', fetcher),
    ).resolves.toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer secret-token', Accept: 'application/json' },
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    );

    const denied = vi.fn(async () => new Response('secret-token', { status: 401 }));
    await expect(
      requestTimewebJson('https://example.test', 'secret-token', denied),
    ).rejects.toThrow('TIMEWEB_API_401');
  });

  it('reads both GET resources, enqueues one group alert and persists active state', async () => {
    const test = fixture();

    const snapshot = await runTimewebMonitor(
      { token: 'secret-token', companyId: 'company-a' },
      test.dependencies,
    );

    expect(test.request.mock.calls.map(([path]) => path)).toEqual([
      'https://api.timeweb.cloud/api/v1/account/finances',
      'https://api.timeweb.cloud/api/v1/servers',
    ]);
    expect(test.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            companyId: 'company-a',
            chatId: '-100777',
            template: 'SYSTEM_BILLING_ALERT',
            eventKey: expect.stringMatching(/^timeweb-balance-low:company-a:/u),
            payload: expect.objectContaining({ message: expect.stringContaining('Timeweb') }),
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(snapshot.alertActive).toBe(true);
    expect(test.writeSnapshot).toHaveBeenCalledWith(snapshot);
    expect(JSON.stringify(snapshot)).not.toContain('secret-token');
  });

  it('does not enqueue a duplicate while the previous snapshot is active', async () => {
    const first = fixture();
    const previous = await runTimewebMonitor(
      { token: 'secret-token', companyId: 'company-a' },
      first.dependencies,
    );
    const repeated = fixture(previous);

    await runTimewebMonitor(
      { token: 'secret-token', companyId: 'company-a' },
      repeated.dependencies,
    );

    expect(repeated.enqueue).not.toHaveBeenCalled();
  });

  it('resets the alert after a refill above seven days', async () => {
    const active = fixture();
    const previous = await runTimewebMonitor(
      { token: 'secret-token', companyId: 'company-a' },
      active.dependencies,
    );
    const refilled = fixture(previous);
    refilled.request.mockImplementation(async (path: string) =>
      path.endsWith('/account/finances')
        ? { finances: { ...financeResponse.finances, hours_left: 300 } }
        : serverResponse,
    );

    const snapshot = await runTimewebMonitor(
      { token: 'secret-token', companyId: 'company-a' },
      refilled.dependencies,
    );

    expect(snapshot.alertActive).toBe(false);
    expect(refilled.enqueue).not.toHaveBeenCalled();
  });

  it('keeps the alert pending when the work group is not configured', async () => {
    const test = fixture();
    test.dependencies.findGroup.mockResolvedValue(null);

    const snapshot = await runTimewebMonitor(
      { token: 'secret-token', companyId: 'company-a' },
      test.dependencies,
    );

    expect(test.enqueue).not.toHaveBeenCalled();
    expect(snapshot.alertActive).toBe(false);
    expect(test.writeSnapshot).toHaveBeenCalledWith(snapshot);
  });
});
