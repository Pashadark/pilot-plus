import { describe, expect, it } from 'vitest';

import { parseDepositReturnInput } from './deposit-return';

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
