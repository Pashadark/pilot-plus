import { describe, expect, it } from 'vitest';

import { resolveRentalDepositState } from './deposit-state';

describe('resolveRentalDepositState', () => {
  it('uses a terminal committed operation ahead of confirmed payments', () => {
    expect(
      resolveRentalDepositState({
        expectedMinor: BigInt(20_000),
        operations: [
          {
            id: 'return-1',
            status: 'COMMITTED',
            occurredAt: new Date('2026-09-01T09:00:00.000Z'),
            depositStatus: 'RETURNED',
          },
        ],
        payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(20_000) }],
      }),
    ).toBe('RETURNED');
  });

  it('treats a fully covered confirmed deposit payment as collected', () => {
    expect(
      resolveRentalDepositState({
        expectedMinor: BigInt(20_000),
        operations: [],
        payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(20_000) }],
      }),
    ).toBe('COLLECTED');
  });

  it('does not treat a partial deposit payment as collected', () => {
    expect(
      resolveRentalDepositState({
        expectedMinor: BigInt(20_000),
        operations: [],
        payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(19_999) }],
      }),
    ).toBeNull();
  });

  it('ignores cancelled and non-deposit payments', () => {
    expect(
      resolveRentalDepositState({
        expectedMinor: BigInt(20_000),
        operations: [],
        payments: [
          { kind: 'DEPOSIT', status: 'CANCELLED', amountMinor: BigInt(20_000) },
          { kind: 'RENT', status: 'CONFIRMED', amountMinor: BigInt(20_000) },
        ],
      }),
    ).toBeNull();
  });

  it('uses the latest committed deposit operation deterministically', () => {
    const occurredAt = new Date('2026-09-01T09:00:00.000Z');

    expect(
      resolveRentalDepositState({
        expectedMinor: BigInt(20_000),
        operations: [
          {
            id: 'operation-a',
            status: 'COMMITTED',
            occurredAt,
            depositStatus: 'COLLECTED',
          },
          {
            id: 'operation-z',
            status: 'COMMITTED',
            occurredAt,
            depositStatus: 'WITHHELD',
          },
        ],
        payments: [],
      }),
    ).toBe('WITHHELD');
  });
});
