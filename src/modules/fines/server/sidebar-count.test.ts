import { describe, expect, it, vi } from 'vitest';

const count = vi.hoisted(() => vi.fn());
vi.mock('@/database/prisma/client', () => ({ prisma: { fine: { count } } }));

import { getOpenFineSidebarCount } from './sidebar-count';

describe('getOpenFineSidebarCount', () => {
  it('counts only unpaid actionable fines in the permitted companies', async () => {
    count.mockResolvedValue(64);

    await expect(
      getOpenFineSidebarCount({ scope: 'COMPANY', companyIds: ['company-a', 'company-b'] }),
    ).resolves.toBe(64);

    expect(count).toHaveBeenCalledWith({
      where: {
        companyId: { in: ['company-a', 'company-b'] },
        status: { in: ['NEW', 'UNPAID', 'OVERDUE'] },
      },
    });
  });

  it('does not expose a badge to a user without fine access', async () => {
    count.mockClear();
    await expect(getOpenFineSidebarCount(null)).resolves.toBe(0);
    expect(count).not.toHaveBeenCalled();
  });
});
