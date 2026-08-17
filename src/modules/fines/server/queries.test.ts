import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFineAccessMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../access', () => ({
  getFineAccess: getFineAccessMock,
  FineAccessDeniedError: class extends Error {},
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: { fine: { findMany: findManyMock } },
}));

import { listFinesForCurrentUser } from './queries';

describe('fine queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forces exact tenant IDs for company users', async () => {
    getFineAccessMock.mockResolvedValue({ scope: 'COMPANY', companyIds: ['company-a'] });
    findManyMock.mockResolvedValue([]);

    await expect(listFinesForCurrentUser({ status: 'UNPAID' })).resolves.toEqual({
      fines: [],
      summary: { newCount: 0, unpaidCount: 0, unpaidAmountMinor: '0', unassignedCount: 0 },
    });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: { in: ['company-a'] }, status: 'UNPAID' }),
      }),
    );
  });
});
