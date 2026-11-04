import { describe, expect, it, vi } from 'vitest';

const getDepositWorkspace = vi.hoisted(() => vi.fn());
vi.mock('./queries', () => ({ getDepositWorkspace }));

import { getUrgentDepositSidebarCount } from './sidebar-count';

describe('getUrgentDepositSidebarCount', () => {
  it('returns only urgent and soon deposit returns', async () => {
    getDepositWorkspace.mockResolvedValue({ summary: { urgentCount: 7 } });

    await expect(
      getUrgentDepositSidebarCount({ scope: 'COMPANY', companyIds: ['company-1'] } as never),
    ).resolves.toBe(7);
  });

  it('returns zero without rental access', async () => {
    getDepositWorkspace.mockClear();
    await expect(getUrgentDepositSidebarCount(null)).resolves.toBe(0);
    expect(getDepositWorkspace).not.toHaveBeenCalled();
  });

  it('does not take down the whole protected shell when one deposit ledger is inconsistent', async () => {
    getDepositWorkspace.mockRejectedValueOnce(new Error('INVALID_DEPOSIT_LEDGER'));

    await expect(
      getUrgentDepositSidebarCount({ scope: 'COMPANY', companyIds: ['company-1'] } as never),
    ).resolves.toBe(0);
  });
});
