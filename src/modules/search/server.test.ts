import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  clients: vi.fn(),
  leads: vi.fn(),
  rentals: vi.fn(),
  finesAccess: vi.fn().mockResolvedValue(null),
  fineFind: vi.fn().mockResolvedValue([]),
  vehicle: vi.fn().mockResolvedValue([]),
  clientFind: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/auth/session', () => ({ readSession: mocks.session }));
vi.mock('@/modules/clients/access', () => ({
  getClientAccess: (p: string) => (p === 'VIEW_CLIENTS' ? mocks.clients() : mocks.leads()),
}));
vi.mock('@/modules/rentals/server/access', () => ({ getRentalAccess: mocks.rentals }));
vi.mock('@/modules/fines/access', () => ({ getFineAccessForUser: mocks.finesAccess }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    vehicle: { findMany: mocks.vehicle },
    client: { findMany: mocks.clientFind },
    fine: { findMany: mocks.fineFind },
  },
}));
import { globalSearch } from './server';
describe('search access', () => {
  it('does not query fines without fine access even for a decree number', async () => {
    mocks.session.mockResolvedValue({ id: 'u1' });
    mocks.clients.mockResolvedValue(null);
    mocks.leads.mockResolvedValue(null);
    mocks.rentals.mockResolvedValue(null);
    await globalSearch('18810550260831308048');
    expect(mocks.fineFind).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.finesAccess.mockResolvedValue(null);
    mocks.fineFind.mockResolvedValue([]);
  });
  it('finds a decree fragment within allowed companies and links to the exact fine', async () => {
    mocks.session.mockResolvedValue({ id: 'u1' });
    mocks.clients.mockResolvedValue(null);
    mocks.leads.mockResolvedValue(null);
    mocks.rentals.mockResolvedValue(null);
    mocks.finesAccess.mockResolvedValue({ scope: 'COMPANY', companyIds: ['tenant-a'] });
    mocks.fineFind.mockResolvedValue([
      {
        id: 'f1',
        companyId: 'tenant-a',
        decreeNumber: '18810550260831308048',
        vehicle: { model: 'Camry', registrationNumber: 'А123АА777' },
      },
    ]);
    const response = await globalSearch('№ 3130 8048');
    expect(mocks.fineFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: { in: ['tenant-a'] }, decreeNumber: { contains: '31308048' } },
      }),
    );
    expect(response.results).toContainEqual(
      expect.objectContaining({
        group: 'Штрафы',
        title: '18810550260831308048',
        href: '/fines?companyId=tenant-a&query=18810550260831308048#fine-f1',
      }),
    );
    mocks.finesAccess.mockResolvedValue(null);
    mocks.vehicle.mockClear();
  });
  it('requires a session before querying', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(globalSearch('Polo')).rejects.toThrow('UNAUTHORIZED');
    expect(mocks.vehicle).not.toHaveBeenCalled();
  });
  it('scopes cars to memberships and skips denied domains', async () => {
    mocks.session.mockResolvedValue({ id: 'u1' });
    mocks.clients.mockResolvedValue(null);
    mocks.leads.mockResolvedValue(null);
    mocks.rentals.mockResolvedValue(null);
    expect((await globalSearch('Polo')).results).toEqual([]);
    expect(mocks.fineFind).not.toHaveBeenCalled();
    expect(mocks.vehicle.mock.calls[0][0].where.company).toEqual({
      members: { some: { userId: 'u1' } },
    });
  });
  it('uses scoped protected phone index without selecting personal documents', async () => {
    vi.stubEnv('CLIENT_SEARCH_KEY', 'test-search-key');
    mocks.session.mockResolvedValue({ id: 'u1' });
    mocks.clients.mockResolvedValue({ scope: 'COMPANY', companyIds: ['tenant-a'] });
    mocks.leads.mockResolvedValue(null);
    mocks.rentals.mockResolvedValue(null);
    await globalSearch('+7 (917) 576-11-77');
    const args = mocks.clientFind.mock.calls[0][0];
    expect(args.where.companyId).toEqual({ in: ['tenant-a'] });
    expect(args.where.phoneIndex).toMatch(/^[a-f0-9]{64}$/);
    expect(args.select.phoneEncrypted).toBeUndefined();
    expect(args.select.passportEncrypted).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
