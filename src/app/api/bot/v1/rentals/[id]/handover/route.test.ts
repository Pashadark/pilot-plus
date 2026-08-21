import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@/modules/bot-api/queries', () => ({ resolveBotIdentity: mocks.resolve }));
vi.mock('@/modules/bot-api/staff-rental-operations', () => ({
  executeStaffHandover: mocks.execute,
}));

import { POST } from './route';

process.env.PILOT_BOT_SERVICE_TOKEN = 'service-token-that-is-long-enough';

describe('staff bot rental handover route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue({ kind: 'STAFF', companyId: 'company-1', userId: 'user-1' });
    mocks.execute.mockResolvedValue({ rentalId: 'rental-1', operationId: 'operation-1' });
  });

  it('binds the multipart command to the authenticated Telegram identity and exact route rental', async () => {
    const form = new FormData();
    form.set('idempotencyKey', 'tg-operation-1');
    form.set('mileageKm', '125430');
    const request = new Request('http://localhost/api/bot/v1/rentals/rental-1/handover', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.PILOT_BOT_SERVICE_TOKEN}`,
        'x-telegram-user-id': '185185047',
        'content-length': '500',
      },
      body: form,
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'rental-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith('185185047');
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1' }),
      'rental-1',
      expect.any(FormData),
    );
  });

  it('rejects an unauthenticated request before identity resolution or operation execution', async () => {
    const response = await POST(
      new Request('http://localhost/api/bot/v1/rentals/rental-1/handover', {
        method: 'POST',
        body: new FormData(),
      }),
      { params: Promise.resolve({ id: 'rental-1' }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
