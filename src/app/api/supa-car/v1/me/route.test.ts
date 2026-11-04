import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateSupaCarOwner = vi.hoisted(() => vi.fn());
vi.mock('@/modules/supa-car/auth/server', () => ({ authenticateSupaCarOwner }));

import { OwnerAuthError } from '@/modules/supa-car/auth/service';

import { GET } from './route';

describe('GET /api/supa-car/v1/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('возвращает только безопасный профиль владельца без внутреннего companyId', async () => {
    authenticateSupaCarOwner.mockResolvedValue({
      id: 'owner-1',
      companyId: 'company-secret',
      displayName: 'Павел Седов',
      phoneE164: '+79161234567',
    });

    const response = await GET(new Request('http://localhost/api/supa-car/v1/me'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      id: 'owner-1',
      displayName: 'Павел Седов',
      phoneMasked: '+7 *** ***-**-67',
    });
  });

  it('возвращает единый 401 без утечки причины', async () => {
    authenticateSupaCarOwner.mockRejectedValue(new OwnerAuthError('UNAUTHORIZED', 401));

    const response = await GET(new Request('http://localhost/api/supa-car/v1/me'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'UNAUTHORIZED' } });
  });
});
