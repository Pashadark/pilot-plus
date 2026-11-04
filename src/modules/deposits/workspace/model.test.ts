import { describe, expect, it } from 'vitest';

import { buildDepositWorkspace, filterDepositRows } from './model';

const day = (value: string) => new Date(`${value}T12:00:00.000Z`);

function rental(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rental-1',
    companyId: 'company-1',
    contractNumber: 'ME-2026-0087-ODI',
    status: 'COMPLETED',
    endsAt: day('2026-09-18'),
    completedAt: day('2026-09-18'),
    depositMinor: 50_000n,
    currency: 'RUB',
    client: { id: 'client-1', firstName: 'Иван', middleName: 'Иванович', lastName: 'Божко' },
    vehicle: { make: 'Kia', model: 'Cerato', modelName: 'Cerato', registrationNumber: 'С886АУ997' },
    depositLedgerEntries: [
      {
        id: 'entry-1',
        kind: 'DEPOSIT_PAYMENT',
        reason: 'Залог внесён',
        cashDeltaMinor: 50_000n,
        reservedDeltaMinor: 0n,
        withheldDeltaMinor: 0n,
        debtDeltaMinor: 0n,
        occurredAt: day('2026-09-18'),
      },
    ],
    ...overrides,
  };
}

describe('buildDepositWorkspace', () => {
  it('calculates the 21-business-day return deadline and urgent totals', () => {
    const workspace = buildDepositWorkspace([rental()], day('2026-10-19'));

    expect(workspace.rows[0]).toMatchObject({
      returnDueOn: '2026-10-19',
      status: 'TODAY',
      availableMinor: 50_000n,
    });
    expect(workspace.summary).toMatchObject({
      availableMinor: 50_000n,
      urgentCount: 1,
      reservedMinor: 0n,
      debtMinor: 0n,
    });
  });

  it('distinguishes reserved, debt and returned balances', () => {
    const reserved = rental({
      id: 'reserved',
      depositLedgerEntries: [
        ...rental().depositLedgerEntries,
        {
          id: 'reserve',
          kind: 'FINE_RESERVATION',
          reason: 'Штраф',
          cashDeltaMinor: 0n,
          reservedDeltaMinor: 20_000n,
          withheldDeltaMinor: 0n,
          debtDeltaMinor: 5_000n,
          occurredAt: day('2026-10-01'),
        },
      ],
    });
    const returned = rental({
      id: 'returned',
      depositLedgerEntries: [
        ...rental().depositLedgerEntries,
        {
          id: 'return',
          kind: 'DEPOSIT_RETURN',
          reason: 'Возвращён',
          cashDeltaMinor: -50_000n,
          reservedDeltaMinor: 0n,
          withheldDeltaMinor: 0n,
          debtDeltaMinor: 0n,
          occurredAt: day('2026-10-19'),
        },
      ],
    });

    const workspace = buildDepositWorkspace([reserved, returned], day('2026-10-20'));

    expect(workspace.rows.find((row) => row.id === 'reserved')).toMatchObject({
      status: 'DEBT',
      reservedMinor: 20_000n,
      debtMinor: 5_000n,
      availableMinor: 30_000n,
    });
    expect(workspace.rows.find((row) => row.id === 'returned')?.status).toBe('RETURNED');
    expect(workspace.summary).toMatchObject({ reservedMinor: 20_000n, debtMinor: 5_000n });
  });

  it('marks a fully withheld deposit as settled instead of overdue', () => {
    const fullyWithheld = rental({
      id: 'fully-withheld',
      depositLedgerEntries: [
        ...rental().depositLedgerEntries,
        {
          id: 'withheld',
          kind: 'DEPOSIT_RETURN',
          reason: 'Удержан полностью',
          cashDeltaMinor: 0n,
          reservedDeltaMinor: 0n,
          withheldDeltaMinor: 50_000n,
          debtDeltaMinor: 0n,
          occurredAt: day('2026-10-17'),
        },
      ],
    });

    const workspace = buildDepositWorkspace([fullyWithheld], day('2026-10-21'));

    expect(workspace.rows[0]).toMatchObject({
      status: 'WITHHELD',
      availableMinor: 0n,
      withheldMinor: 50_000n,
    });
    expect(workspace.summary.urgentCount).toBe(0);
  });

  it('marks a partial refund with withholding as settled instead of overdue', () => {
    const partiallyReturned = rental({
      id: 'partially-returned',
      depositLedgerEntries: [
        ...rental().depositLedgerEntries,
        {
          id: 'partial-return',
          kind: 'DEPOSIT_RETURN',
          reason: 'Часть возвращена, часть удержана',
          cashDeltaMinor: -30_000n,
          reservedDeltaMinor: 0n,
          withheldDeltaMinor: 20_000n,
          debtDeltaMinor: 0n,
          occurredAt: day('2026-10-17'),
        },
      ],
    });

    const workspace = buildDepositWorkspace([partiallyReturned], day('2026-10-21'));

    expect(workspace.rows[0]).toMatchObject({
      status: 'RETURNED_WITH_WITHHOLDING',
      availableMinor: 0n,
      withheldMinor: 20_000n,
    });
    expect(filterDepositRows(workspace.rows, { filter: 'returned' })).toHaveLength(1);
  });
});

describe('filterDepositRows', () => {
  it('searches client, vehicle, plate and contract and applies quick status filters', () => {
    const { rows } = buildDepositWorkspace([rental()], day('2026-10-19'));

    expect(filterDepositRows(rows, { query: 'с886ау997', filter: 'all' })).toHaveLength(1);
    expect(filterDepositRows(rows, { query: 'божко', filter: 'all' })).toHaveLength(1);
    expect(filterDepositRows(rows, { query: 'не найдено', filter: 'all' })).toHaveLength(0);
    expect(filterDepositRows(rows, { query: '', filter: 'urgent' })).toHaveLength(1);
    expect(filterDepositRows(rows, { query: '', filter: 'returned' })).toHaveLength(0);
  });
});
