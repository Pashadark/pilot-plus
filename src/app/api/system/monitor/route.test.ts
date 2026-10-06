import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ readSession: vi.fn(), snapshot: vi.fn() }));
vi.mock('@/services/auth/session', () => ({ readSession: mocks.readSession }));
vi.mock('@/modules/system-health/monitor-server', () => ({ getMonitorSnapshot: mocks.snapshot }));
import { GET } from './route';
describe('monitor API', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    [null, 401],
    [{ role: 'MEMBER', canAccessAdmin: true }, 403],
  ])('rejects unauthorized users before probes', async (user, status) => {
    mocks.readSession.mockResolvedValue(user);
    expect((await GET()).status).toBe(status);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it('serves uncached results to superadmin', async () => {
    mocks.readSession.mockResolvedValue({ role: 'SUPER_ADMIN' });
    mocks.snapshot.mockResolvedValue({ cards: [], checkedAt: 'now' });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('does not leak raw provider errors', async () => {
    mocks.readSession.mockResolvedValue({ role: 'SUPER_ADMIN' });
    mocks.snapshot.mockRejectedValue(new Error('secret-token'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret-token');
  });
});
