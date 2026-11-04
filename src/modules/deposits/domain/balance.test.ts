import { describe, expect, it } from 'vitest';

import { projectDepositBalance, type DepositLedgerDelta } from './balance';

function entry(delta: Partial<DepositLedgerDelta>): DepositLedgerDelta {
  return {
    cashDeltaMinor: 0n,
    reservedDeltaMinor: 0n,
    withheldDeltaMinor: 0n,
    debtDeltaMinor: 0n,
    ...delta,
  };
}

describe('projectDepositBalance', () => {
  it('separates available money from a fine reservation', () => {
    expect(
      projectDepositBalance([
        entry({ cashDeltaMinor: 2_000_000n }),
        entry({ reservedDeltaMinor: 431_250n }),
      ]),
    ).toEqual({
      cashMinor: 2_000_000n,
      reservedMinor: 431_250n,
      withheldMinor: 0n,
      debtMinor: 0n,
      availableMinor: 1_568_750n,
    });
  });

  it('tracks the uncovered amount as debt without making the balance negative', () => {
    expect(
      projectDepositBalance([
        entry({ cashDeltaMinor: 100_000n }),
        entry({ reservedDeltaMinor: 100_000n, debtDeltaMinor: 331_250n }),
      ]),
    ).toEqual({
      cashMinor: 100_000n,
      reservedMinor: 100_000n,
      withheldMinor: 0n,
      debtMinor: 331_250n,
      availableMinor: 0n,
    });
  });

  it('moves a reservation to a final withholding without reducing availability twice', () => {
    expect(
      projectDepositBalance([
        entry({ cashDeltaMinor: 1_000_000n }),
        entry({ reservedDeltaMinor: 431_250n }),
        entry({ reservedDeltaMinor: -431_250n, withheldDeltaMinor: 431_250n }),
      ]),
    ).toMatchObject({
      cashMinor: 1_000_000n,
      reservedMinor: 0n,
      withheldMinor: 431_250n,
      availableMinor: 568_750n,
    });
  });

  it('represents a partial deposit return and retained amount', () => {
    expect(
      projectDepositBalance([
        entry({ cashDeltaMinor: 1_000_000n }),
        entry({ cashDeltaMinor: -800_000n, withheldDeltaMinor: 200_000n }),
      ]),
    ).toMatchObject({ cashMinor: 200_000n, withheldMinor: 200_000n, availableMinor: 0n });
  });

  it('rejects an impossible negative available balance', () => {
    expect(() =>
      projectDepositBalance([
        entry({ cashDeltaMinor: 100_000n }),
        entry({ reservedDeltaMinor: 100_001n }),
      ]),
    ).toThrow('INVALID_DEPOSIT_LEDGER');
  });
});
