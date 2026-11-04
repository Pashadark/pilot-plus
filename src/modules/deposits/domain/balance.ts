export interface DepositLedgerDelta {
  cashDeltaMinor: bigint;
  reservedDeltaMinor: bigint;
  withheldDeltaMinor: bigint;
  debtDeltaMinor: bigint;
}

export interface DepositBalance {
  cashMinor: bigint;
  reservedMinor: bigint;
  withheldMinor: bigint;
  debtMinor: bigint;
  availableMinor: bigint;
}

export function projectDepositBalance(entries: readonly DepositLedgerDelta[]): DepositBalance {
  const totals = entries.reduce(
    (balance, entry) => ({
      cashMinor: balance.cashMinor + entry.cashDeltaMinor,
      reservedMinor: balance.reservedMinor + entry.reservedDeltaMinor,
      withheldMinor: balance.withheldMinor + entry.withheldDeltaMinor,
      debtMinor: balance.debtMinor + entry.debtDeltaMinor,
    }),
    { cashMinor: 0n, reservedMinor: 0n, withheldMinor: 0n, debtMinor: 0n },
  );
  const availableMinor = totals.cashMinor - totals.reservedMinor - totals.withheldMinor;

  if (
    totals.cashMinor < 0n ||
    totals.reservedMinor < 0n ||
    totals.withheldMinor < 0n ||
    totals.debtMinor < 0n ||
    availableMinor < 0n
  ) {
    throw new Error('INVALID_DEPOSIT_LEDGER');
  }

  return { ...totals, availableMinor };
}
