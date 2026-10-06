import { describe, expect, it } from 'vitest';

import { buildHistoricalPaymentBackfillPlan } from './historical-payment-backfill';

describe('buildHistoricalPaymentBackfillPlan', () => {
  it('восстанавливает только недостающую оплату импортированного действующего договора', () => {
    expect(
      buildHistoricalPaymentBackfillPlan([
        {
          id: 'rental-1',
          companyId: 'company-1',
          contractNumber: 'ME-2026-0034-KN',
          status: 'ACTIVE',
          totalPriceMinor: BigInt(3_000_000),
          paidMinor: BigInt(1_000_000),
          importedFrom: 'signed-contract-photos-20260907',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        rentalId: 'rental-1',
        amountMinor: BigInt(2_000_000),
        idempotencyKey: 'historical-rent-payment-v1',
      }),
    ]);
  });

  it('не создаёт оплату повторно и не меняет отменённые, черновые или системные договоры', () => {
    expect(
      buildHistoricalPaymentBackfillPlan([
        {
          id: 'paid',
          companyId: 'company-1',
          contractNumber: 'ME-2026-0033-ZN',
          status: 'ACTIVE',
          totalPriceMinor: BigInt(11_000_000),
          paidMinor: BigInt(11_000_000),
          importedFrom: 'signed-contract-photos-20260907',
        },
        {
          id: 'cancelled',
          companyId: 'company-1',
          contractNumber: 'ME-2026-0025-LN',
          status: 'CANCELLED',
          totalPriceMinor: BigInt(8_215_000),
          paidMinor: BigInt(0),
          importedFrom: 'contracts-021-031-20260830',
        },
        {
          id: 'system',
          companyId: 'company-1',
          contractNumber: 'ME-2026-0040-AA',
          status: 'ACTIVE',
          totalPriceMinor: BigInt(1_000_000),
          paidMinor: BigInt(0),
          importedFrom: 'system',
        },
      ]),
    ).toEqual([]);
  });
});
