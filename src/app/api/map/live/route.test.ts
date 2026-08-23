import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/modules/auth/dal', () => ({ getCurrentUser }));

import { GET } from './route';

describe('GET /api/map/live', () => {
  beforeEach(() => vi.clearAllMocks());

  it('отказывает до Redis и базы без сессии', async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await GET(new Request('http://localhost/api/map/live'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
