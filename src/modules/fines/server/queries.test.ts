import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFineAccessMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());
const companyFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../access', () => ({
  getFineAccess: getFineAccessMock,
  FineAccessDeniedError: class extends Error {},
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: { fine: { findMany: findManyMock }, company: { findMany: companyFindManyMock } },
}));

import { listFinesForCurrentUser } from './queries';

describe('fine queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forces exact tenant IDs for company users', async () => {
    getFineAccessMock.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-a'],
      rolesByCompany: { 'company-a': 'DISPATCHER' },
    });
    companyFindManyMock.mockResolvedValue([{ id: 'company-a', name: 'Компания А' }]);
    findManyMock.mockResolvedValue([]);

    await expect(listFinesForCurrentUser({ status: 'UNPAID' })).resolves.toEqual({
      companies: [{ id: 'company-a', name: 'Компания А' }],
      selectedCompanyId: 'company-a',
      canSync: true,
      fines: [],
      summary: { newCount: 0, unpaidCount: 0, unpaidAmountMinor: '0', unassignedCount: 0 },
    });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a', status: 'UNPAID' }),
      }),
    );
  });
});
