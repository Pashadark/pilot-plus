import { describe, expect, it } from 'vitest';

import { paymentCommandSchema, signatureCommandSchema } from './validation';

describe('rental settlement validation', () => {
  it('normalizes a positive payment in minor units', () => {
    expect(
      paymentCommandSchema.parse({
        rentalId: 'rental-1',
        kind: 'RENT',
        amountMinor: '3200000',
        method: 'TRANSFER',
        idempotencyKey: 'payment-rental-1-1',
      }),
    ).toMatchObject({ amountMinor: BigInt(3200000), kind: 'RENT', method: 'TRANSFER' });
  });

  it('rejects zero and negative payments', () => {
    expect(() =>
      paymentCommandSchema.parse({
        rentalId: 'rental-1',
        kind: 'DEPOSIT',
        amountMinor: '0',
        method: 'CASH',
        idempotencyKey: 'payment-rental-1-2',
      }),
    ).toThrow();
  });

  it('requires actor-visible signature facts when a party is signed', () => {
    expect(
      signatureCommandSchema.parse({
        rentalId: 'rental-1',
        party: 'CLIENT',
        status: 'SIGNED',
        signedByName: 'Анна Воронова',
      }),
    ).toMatchObject({ party: 'CLIENT', status: 'SIGNED', signedByName: 'Анна Воронова' });

    expect(() =>
      signatureCommandSchema.parse({
        rentalId: 'rental-1',
        party: 'CLIENT',
        status: 'SIGNED',
        signedByName: '',
      }),
    ).toThrow();
  });
});
