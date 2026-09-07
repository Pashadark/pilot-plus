import { describe, expect, it, vi } from 'vitest';

import { syncDueCompanyFines } from './scheduled-fine-sync';

describe('scheduled fine sync', () => {
  it('claims integrations not checked for three hours and syncs each company once', async () => {
    const database = {
      fineIntegration: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ companyId: 'company-1' }, { companyId: 'company-2' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const sync = vi.fn().mockResolvedValue(undefined);
    const now = new Date('2026-09-07T09:00:00Z');

    await expect(syncDueCompanyFines(now, database as never, sync)).resolves.toBe(2);

    expect(database.fineIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enabled: true,
          OR: expect.arrayContaining([
            { lastAttemptAt: null },
            { lastAttemptAt: { lt: new Date('2026-09-07T06:00:00Z') } },
          ]),
        }),
      }),
    );
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('does not call the provider when another worker already claimed the interval', async () => {
    const database = {
      fineIntegration: {
        findMany: vi.fn().mockResolvedValue([{ companyId: 'company-1' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const sync = vi.fn();

    await expect(
      syncDueCompanyFines(new Date('2026-09-07T09:00:00Z'), database as never, sync),
    ).resolves.toBe(0);
    expect(sync).not.toHaveBeenCalled();
  });

  it('does not query integrations outside the scheduler check window', async () => {
    const database = {
      fineIntegration: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    const sync = vi.fn();

    await expect(
      syncDueCompanyFines(new Date('2026-09-07T09:00:30Z'), database as never, sync),
    ).resolves.toBe(0);
    expect(database.fineIntegration.findMany).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });
});
