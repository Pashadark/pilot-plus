import { describe, expect, it } from 'vitest';

import { selectFineAttribution } from './attribute-fine';

const offenseAt = new Date('2026-08-16T09:30:00.000Z');

describe('fine attribution', () => {
  it('selects the only half-open rental containing the offense', () => {
    expect(
      selectFineAttribution(offenseAt, [
        {
          id: 'rental-a',
          clientId: 'client-a',
          startsAt: new Date('2026-08-16T08:00:00.000Z'),
          endsAt: new Date('2026-08-16T10:00:00.000Z'),
        },
      ]),
    ).toEqual({ kind: 'MATCHED', rentalId: 'rental-a', clientId: 'client-a' });
  });

  it('does not guess when rentals overlap', () => {
    const rentals = ['a', 'b'].map((id) => ({
      id,
      clientId: `client-${id}`,
      startsAt: new Date('2026-08-16T08:00:00.000Z'),
      endsAt: new Date('2026-08-16T10:00:00.000Z'),
    }));
    expect(selectFineAttribution(offenseAt, rentals)).toEqual({ kind: 'AMBIGUOUS' });
  });

  it('uses a half-open end boundary', () => {
    expect(
      selectFineAttribution(offenseAt, [
        {
          id: 'ended',
          clientId: 'client-ended',
          startsAt: new Date('2026-08-16T08:00:00.000Z'),
          endsAt: offenseAt,
        },
      ]),
    ).toEqual({ kind: 'UNMATCHED' });
  });
});
