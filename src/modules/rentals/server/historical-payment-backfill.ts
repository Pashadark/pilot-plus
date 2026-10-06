export type HistoricalRentalPaymentSource = {
  id: string;
  companyId: string;
  contractNumber: string | null;
  status: string;
  totalPriceMinor: bigint;
  paidMinor: bigint;
  importedFrom: string | null;
};

export type HistoricalRentalPaymentBackfill = {
  rentalId: string;
  companyId: string;
  contractNumber: string;
  amountMinor: bigint;
  idempotencyKey: 'historical-rent-payment-v1';
};

const payableStatuses = new Set(['CONFIRMED', 'ACTIVE', 'COMPLETED']);

function isHistoricalImport(source: string | null) {
  return source?.startsWith('contracts-') || source?.startsWith('signed-contract-');
}

export function buildHistoricalPaymentBackfillPlan(
  rentals: readonly HistoricalRentalPaymentSource[],
): HistoricalRentalPaymentBackfill[] {
  return rentals.flatMap((rental) => {
    if (
      !rental.contractNumber ||
      !payableStatuses.has(rental.status) ||
      !isHistoricalImport(rental.importedFrom) ||
      rental.totalPriceMinor <= BigInt(0) ||
      rental.paidMinor >= rental.totalPriceMinor
    ) {
      return [];
    }

    return [
      {
        rentalId: rental.id,
        companyId: rental.companyId,
        contractNumber: rental.contractNumber,
        amountMinor: rental.totalPriceMinor - rental.paidMinor,
        idempotencyKey: 'historical-rent-payment-v1' as const,
      },
    ];
  });
}
