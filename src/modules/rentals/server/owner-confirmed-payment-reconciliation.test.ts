import { describe, expect, it } from 'vitest';

import {
  OWNER_CONFIRMED_PAYMENT_IDEMPOTENCY_PREFIX,
  planOwnerConfirmedPaymentReconciliation,
} from './owner-confirmed-payment-reconciliation';

describe('planOwnerConfirmedPaymentReconciliation', () => {
  it('creates only the missing net rental payment for a payable contract', () => {
    expect(
      planOwnerConfirmedPaymentReconciliation([
        {
          id: 'rental-1',
          companyId: 'company-1',
          contractNumber: 'ME-2026-0001',
          status: 'ACTIVE',
          currency: 'RUB',
          totalPriceMinor: BigInt(10_000),
          confirmedRentMinor: BigInt(7_000),
          refundedRentMinor: BigInt(1_000),
          existingIdempotencyKeys: [],
        },
      ]),
    ).toEqual([
      {
        rentalId: 'rental-1',
        companyId: 'company-1',
        contractNumber: 'ME-2026-0001',
        currency: 'RUB',
        amountMinor: BigInt(4_000),
        idempotencyKey: `${OWNER_CONFIRMED_PAYMENT_IDEMPOTENCY_PREFIX}:rental-1`,
      },
    ]);
  });

  it.each([
    ['fully paid', 'ACTIVE', BigInt(10_000), BigInt(10_000), BigInt(0)],
    ['overpaid', 'COMPLETED', BigInt(10_000), BigInt(12_000), BigInt(0)],
    ['draft', 'DRAFT', BigInt(10_000), BigInt(0), BigInt(0)],
    ['cancelled', 'CANCELLED', BigInt(10_000), BigInt(0), BigInt(0)],
  ])('skips %s rentals', (_label, status, total, confirmed, refunded) => {
    expect(
      planOwnerConfirmedPaymentReconciliation([
        {
          id: 'rental-1',
          companyId: 'company-1',
          contractNumber: 'ME-2026-0001',
          status,
          currency: 'RUB',
          totalPriceMinor: total,
          confirmedRentMinor: confirmed,
          refundedRentMinor: refunded,
          existingIdempotencyKeys: [],
        },
      ]),
    ).toEqual([]);
  });

  it('is idempotent when the reconciliation payment already exists', () => {
    expect(
      planOwnerConfirmedPaymentReconciliation([
        {
          id: 'rental-1',
          companyId: 'company-1',
          contractNumber: 'ME-2026-0001',
          status: 'CONFIRMED',
          currency: 'RUB',
          totalPriceMinor: BigInt(10_000),
          confirmedRentMinor: BigInt(0),
          refundedRentMinor: BigInt(0),
          existingIdempotencyKeys: [
            `${OWNER_CONFIRMED_PAYMENT_IDEMPOTENCY_PREFIX}:rental-1`,
          ],
        },
      ]),
    ).toEqual([]);
  });
});
