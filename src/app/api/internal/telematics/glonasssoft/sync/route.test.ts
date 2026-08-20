import { afterEach, describe, expect, it, vi } from 'vitest';

const syncCompanyLatestPositions = vi.hoisted(() => vi.fn());
vi.mock('@/modules/telematics/glonasssoft/sync-company.server', () => ({
  syncCompanyLatestPositions,
}));

import { POST, dynamic, runtime } from './route';

describe('внутренний no-store sync GLONASSSoft', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('использует Node runtime и принудительную динамику', () => {
    expect(runtime).toBe('nodejs');
    expect(dynamic).toBe('force-dynamic');
  });

  it('отказывает до чтения компании и синхронизации без service token', async () => {
    vi.stubEnv('PILOT_TELEMATICS_SERVICE_TOKEN', 'service-token-with-enough-entropy');
    const request = new Request('http://localhost/api/internal/telematics/glonasssoft/sync', {
      method: 'POST',
      body: JSON.stringify({ companyId: 'company-a' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(syncCompanyLatestPositions).not.toHaveBeenCalled();
  });

  it('синхронизирует только валидный companyId после авторизации', async () => {
    vi.stubEnv('PILOT_TELEMATICS_SERVICE_TOKEN', 'service-token-with-enough-entropy');
    syncCompanyLatestPositions.mockResolvedValue({ requested: 10, saved: 9, skipped: 1 });
    const request = new Request('http://localhost/api/internal/telematics/glonasssoft/sync', {
      method: 'POST',
      body: JSON.stringify({ companyId: 'company-a' }),
      headers: {
        authorization: 'Bearer service-token-with-enough-entropy',
        'content-type': 'application/json',
        'content-length': '25',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ requested: 10, saved: 9, skipped: 1 });
    expect(syncCompanyLatestPositions).toHaveBeenCalledWith('company-a');
  });
});
