import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
const itemUpdateMany = vi.hoisted(() => vi.fn());
const auditCreate = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    fineInvoice: { findMany },
    $transaction: transaction,
  },
}));

import { reconcileStaleFineInvoices } from './reconcile-fine-invoices';

const now = new Date('2026-08-18T12:00:00.000Z');

function database() {
  return {
    fineInvoice: { findMany, updateMany },
    $transaction: transaction,
  };
}

describe('reconcileStaleFineInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (operation) =>
      operation({
        fineInvoice: { updateMany },
        fineInvoiceItem: { updateMany: itemUpdateMany },
        auditLog: { create: auditCreate },
      }),
    );
    updateMany.mockResolvedValue({ count: 1 });
    itemUpdateMany.mockResolvedValue({ count: 1 });
    auditCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('claims only a bounded batch of stale PENDING invoices and marks them retryable ERROR', async () => {
    findMany.mockResolvedValue([
      {
        id: 'invoice-stale',
        companyId: 'company-1',
        status: 'PENDING',
        updatedAt: new Date('2026-08-18T11:00:00.000Z'),
      },
    ]);

    await expect(
      reconcileStaleFineInvoices({ database: database(), now, staleAfterMs: 60_000, batchSize: 1 }),
    ).resolves.toEqual({ reconciled: 1, skipped: 0, hasMore: false });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING', updatedAt: { lte: new Date('2026-08-18T11:59:00.000Z') } },
        orderBy: { updatedAt: 'asc' },
        take: 2,
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'invoice-stale',
        companyId: 'company-1',
        status: 'PENDING',
        updatedAt: new Date('2026-08-18T11:00:00.000Z'),
      },
      data: { status: 'ERROR' },
    });
    expect(itemUpdateMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1', invoiceId: 'invoice-stale', active: true },
      data: { active: false },
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          entityId: 'invoice-stale',
          changes: { status: 'ERROR', reason: 'STALE_PENDING', sandbox: true },
        }),
      }),
    );
  });

  it('lets exactly one concurrent worker own a stale invoice through the compare-and-set claim', async () => {
    const candidate = {
      id: 'invoice-race',
      companyId: 'company-1',
      status: 'PENDING' as const,
      updatedAt: new Date('2026-08-18T11:00:00.000Z'),
    };
    findMany.mockResolvedValue([candidate]);
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const results = await Promise.all([
      reconcileStaleFineInvoices({ database: database(), now }),
      reconcileStaleFineInvoices({ database: database(), now }),
    ]);

    expect(results.map(({ reconciled, skipped }) => ({ reconciled, skipped }))).toEqual([
      { reconciled: 1, skipped: 0 },
      { reconciled: 0, skipped: 1 },
    ]);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('never selects CREATED invoices, preserving idempotent active payment state', async () => {
    findMany.mockResolvedValue([]);

    await expect(reconcileStaleFineInvoices({ database: database(), now })).resolves.toEqual({
      reconciled: 0,
      skipped: 0,
      hasMore: false,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING' }) }),
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
});
