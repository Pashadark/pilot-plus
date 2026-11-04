import { describe, expect, it } from 'vitest';

import { parseDepositReturnInput, planDepositReturnLedger } from './deposit-return';

describe('parseDepositReturnInput', () => {
  it('calculates the withheld amount for a partial return', () => {
    expect(
      parseDepositReturnInput({
        collectedMinor: BigInt(30_000_00),
        returnedRubles: '20000',
        reason: 'Удержано за повреждение',
      }),
    ).toEqual({
      status: 'PARTIALLY_WITHHELD',
      returnedMinor: BigInt(20_000_00),
      withheldMinor: BigInt(10_000_00),
      reason: 'Удержано за повреждение',
    });
  });

  it('marks a full return without requiring a reason', () => {
    expect(
      parseDepositReturnInput({
        collectedMinor: BigInt(30_000_00),
        returnedRubles: '30000',
        reason: '',
      }).status,
    ).toBe('RETURNED');
  });

  it('requires a reason when money is withheld', () => {
    expect(() =>
      parseDepositReturnInput({
        collectedMinor: BigInt(30_000_00),
        returnedRubles: '0',
        reason: '',
      }),
    ).toThrow('Укажите причину удержания');
  });
});

describe('planDepositReturnLedger', () => {
  it('moves an active fine reservation to debt when the full deposit was returned', () => {
    expect(
      planDepositReturnLedger({
        cashMinor: 2_000_000n,
        reservedMinor: 64_688n,
        withheldMinor: 0n,
        returnedMinor: 2_000_000n,
      }),
    ).toEqual({ reservationDebtMinor: 64_688n, additionalWithheldMinor: 0n });
  });

  it('does not count a fine reservation twice when part of the deposit was retained', () => {
    expect(
      planDepositReturnLedger({
        cashMinor: 2_000_000n,
        reservedMinor: 64_688n,
        withheldMinor: 0n,
        returnedMinor: 1_900_000n,
      }),
    ).toEqual({ reservationDebtMinor: 0n, additionalWithheldMinor: 35_312n });
  });
});
