import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/database/prisma/client', () => ({ prisma: {} }));
const intake = vi.hoisted(() => vi.fn());
vi.mock('@/modules/leads/website-intake', () => ({ receiveWebsiteLead: intake }));
import { POST } from './route';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const request = (token: string, body = '{}') =>
  new Request('http://localhost/api/integrations/tgcar/leads', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Length': String(Buffer.byteLength(body)),
    },
    body,
  });
describe('TG CAR integration boundary', () => {
  it('fails closed without configuration', async () => {
    vi.stubEnv('TGCAR_LEAD_SECRET', '');
    expect((await POST(request(''))).status).toBe(503);
    expect(intake).not.toHaveBeenCalled();
  });
  it('rejects wrong and multibyte credentials before persistence', async () => {
    vi.stubEnv('TGCAR_LEAD_SECRET', 'x'.repeat(40));
    expect((await POST(request('y'.repeat(40)))).status).toBe(401);
    expect((await POST(request('é'.repeat(40)))).status).toBe(401);
    expect(intake).not.toHaveBeenCalled();
  });
  it('limits input size and returns only saved reference', async () => {
    vi.stubEnv('TGCAR_LEAD_SECRET', 'x'.repeat(40));
    expect((await POST(request('x'.repeat(40), ' '.repeat(8200)))).status).toBe(413);
    intake.mockResolvedValue({ id: 'tgcar_test', duplicate: false });
    const r = await POST(request('x'.repeat(40)));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: 'tgcar_test', status: 'NEW' });
  });
  it('does not leak persistence errors or claim success', async () => {
    vi.stubEnv('TGCAR_LEAD_SECRET', 'x'.repeat(40));
    intake.mockRejectedValue(new Error('secret database detail'));
    const r = await POST(request('x'.repeat(40)));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('secret');
  });
});
