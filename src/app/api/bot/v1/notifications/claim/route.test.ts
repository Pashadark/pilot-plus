import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate, claim, daily, operational, returns, fineSync } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  claim: vi.fn(),
  daily: vi.fn(),
  operational: vi.fn(),
  returns: vi.fn(),
  fineSync: vi.fn(),
}));

vi.mock('@/modules/bot-api/auth', async (original) => ({
  ...(await original()),
  authenticateBotRequest: authenticate,
}));
vi.mock('@/modules/bot-api/notifications', () => ({
  claimNotificationJobs: claim,
  enqueueDailyOperationsDigests: daily,
  enqueueOperationalAlerts: operational,
  enqueueReturnReminders: returns,
}));
vi.mock('@/modules/bot-api/scheduled-fine-sync', () => ({ syncDueCompanyFines: fineSync }));

import { POST } from './route';

describe('POST /api/bot/v1/notifications/claim', () => {
  beforeEach(() => {
    authenticate.mockReset().mockResolvedValue({ service: 'TELEGRAM_BOT' });
    claim.mockReset().mockResolvedValue([]);
    daily.mockReset().mockResolvedValue(0);
    operational.mockReset().mockResolvedValue(0);
    returns.mockReset().mockResolvedValue(0);
    fineSync.mockReset().mockResolvedValue(0);
  });

  it('collects every notification source before claiming jobs', async () => {
    const response = await POST(
      new Request('http://localhost/api/bot/v1/notifications/claim', {
        method: 'POST',
        headers: { authorization: 'Bearer service', 'content-type': 'application/json' },
        body: JSON.stringify({ workerId: 'pilot-bot' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(daily).toHaveBeenCalledOnce();
    expect(operational).toHaveBeenCalledOnce();
    expect(returns).toHaveBeenCalledOnce();
    expect(fineSync).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledWith(expect.any(Date), 'pilot-bot');
  });

  it('still returns queued jobs when one collector temporarily fails', async () => {
    operational.mockRejectedValueOnce(new Error('temporary telemetry failure'));
    claim.mockResolvedValueOnce([{ id: 'job-1' }]);

    const response = await POST(
      new Request('http://localhost/api/bot/v1/notifications/claim', {
        method: 'POST',
        headers: { authorization: 'Bearer service', 'content-type': 'application/json' },
        body: JSON.stringify({ workerId: 'pilot-bot' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{ id: 'job-1' }] });
  });

  it('passes an explicit client audience to the isolated worker', async () => {
    const response = await POST(
      new Request('http://localhost/api/bot/v1/notifications/claim', {
        method: 'POST',
        headers: { authorization: 'Bearer service', 'content-type': 'application/json' },
        body: JSON.stringify({ workerId: 'supa-client-bot', audience: 'CLIENT' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(claim).toHaveBeenCalledWith(expect.any(Date), 'supa-client-bot', undefined, 'CLIENT');
  });
});
