import { describe, expect, it, vi } from 'vitest';

import { archiveConfirmedFine } from '../src/modules/fines/sync/archive-confirmed-fine';
import { parseArchiveConfirmedFineArgs } from './archive-confirmed-fine-input';

describe('guarded confirmed fine archive', () => {
  it('requires the exact confirmation literal and a numeric external ID', () => {
    expect(() => parseArchiveConfirmedFineArgs(['--external-id', '73166758'])).toThrow(
      'ARCHIVE_CONFIRMED',
    );
    expect(() =>
      parseArchiveConfirmedFineArgs([
        '--external-id',
        'not-a-provider-id',
        '--confirm',
        'ARCHIVE_CONFIRMED',
      ]),
    ).toThrow('числовой внешний ID');
    expect(
      parseArchiveConfirmedFineArgs([
        '--external-id',
        '73166758',
        '--company-id',
        'company-1',
        '--confirm',
        'ARCHIVE_CONFIRMED',
      ]),
    ).toEqual({ externalId: '73166758', companyId: 'company-1' });
  });

  it('archives exactly one provider fine, releases its reservation, and audits the transition', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'fine-1' });
    const createAudit = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const transaction = { fine: { update }, auditLog: { create: createAudit } };
    const database = {
      fine: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'fine-1',
            companyId: 'company-1',
            externalId: '73166758',
            decreeNumber: '18810571260930049102',
            status: 'UNPAID',
            archiveReason: null,
            clientId: 'client-1',
            rentalId: 'rental-1',
            currentAmountMinor: 5_000_00n,
          },
        ]),
      },
      $transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const reconcile = vi.fn().mockResolvedValue(null);
    const now = new Date('2026-11-07T10:00:00.000Z');

    await expect(
      archiveConfirmedFine(database as never, reconcile, {
        externalId: '73166758',
        companyId: 'company-1',
        now,
      }),
    ).resolves.toEqual({
      fineId: 'fine-1',
      decreeNumber: '18810571260930049102',
      previousStatus: 'UNPAID',
      result: 'ARCHIVED',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'fine-1' },
      data: {
        status: 'ARCHIVED',
        archivedAt: now,
        archiveReason: 'MANUAL_CONFIRMED',
        providerMissingSince: null,
        providerMissingSyncCount: 0,
      },
      select: { id: true },
    });
    expect(reconcile).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        companyId: 'company-1',
        clientId: 'client-1',
        rentalId: 'rental-1',
        fineId: 'fine-1',
        status: 'ARCHIVED',
      }),
    );
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        actorUserId: null,
        actorEmailSnapshot: 'system@supapro.local',
        action: 'ARCHIVE',
        entityType: 'FINE',
        entityId: 'fine-1',
        changes: { fromStatus: 'UNPAID', toStatus: 'ARCHIVED', reason: 'MANUAL_CONFIRMED' },
      }),
      select: { id: true },
    });
  });

  it('is idempotent when the fine is already manually archived', async () => {
    const database = {
      fine: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'fine-1',
            companyId: 'company-1',
            externalId: '73166758',
            decreeNumber: '18810571260930049102',
            status: 'ARCHIVED',
            archiveReason: 'MANUAL_CONFIRMED',
            clientId: null,
            rentalId: null,
            currentAmountMinor: 5_000_00n,
          },
        ]),
      },
      $transaction: vi.fn(),
    };

    await expect(
      archiveConfirmedFine(database as never, vi.fn(), {
        externalId: '73166758',
        now: new Date('2026-11-07T10:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ result: 'ALREADY_ARCHIVED' });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('refuses ambiguous matches without a company ID', async () => {
    const database = {
      fine: { findMany: vi.fn().mockResolvedValue([{ id: 'one' }, { id: 'two' }]) },
      $transaction: vi.fn(),
    };

    await expect(
      archiveConfirmedFine(database as never, vi.fn(), {
        externalId: '73166758',
        now: new Date('2026-11-07T10:00:00.000Z'),
      }),
    ).rejects.toThrow('укажите --company-id');
  });
});
