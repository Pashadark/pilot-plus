export const OWNER_CONFIRMED_PAYMENT_IDEMPOTENCY_PREFIX =
  'owner-confirmed-full-payment-2026-09-13-v1';

type RentalPaymentReconciliationSource = {
  id: string;
  companyId: string;
  contractNumber: string | null;
  status: string;
  currency: string;
  totalPriceMinor: bigint;
  confirmedRentMinor: bigint;
  refundedRentMinor: bigint;
  existingIdempotencyKeys: readonly string[];
};

export type OwnerConfirmedPaymentAdjustment = {
  rentalId: string;
  companyId: string;
  contractNumber: string;
  currency: string;
  amountMinor: bigint;
  idempotencyKey: string;
};

const PAYABLE_STATUSES = new Set(['CONFIRMED', 'ACTIVE', 'COMPLETED']);

export function planOwnerConfirmedPaymentReconciliation(
  rentals: readonly RentalPaymentReconciliationSource[],
): OwnerConfirmedPaymentAdjustment[] {
  return rentals.flatMap((rental) => {
    if (
      !PAYABLE_STATUSES.has(rental.status) ||
      !rental.contractNumber ||
      rental.totalPriceMinor <= BigInt(0)
    ) {
      return [];
    }

    const idempotencyKey = `${OWNER_CONFIRMED_PAYMENT_IDEMPOTENCY_PREFIX}:${rental.id}`;
    if (rental.existingIdempotencyKeys.includes(idempotencyKey)) return [];

    const netPaidMinor = rental.confirmedRentMinor - rental.refundedRentMinor;
    const amountMinor = rental.totalPriceMinor - netPaidMinor;
    if (amountMinor <= BigInt(0)) return [];

    return [
      {
        rentalId: rental.id,
        companyId: rental.companyId,
        contractNumber: rental.contractNumber,
        currency: rental.currency,
        amountMinor,
        idempotencyKey,
      },
    ];
  });
}
