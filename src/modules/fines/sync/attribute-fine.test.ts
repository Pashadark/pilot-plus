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
    ).toEqual({
      kind: 'MATCHED',
      rentalId: 'rental-a',
      clientId: 'client-a',
      candidates: [
        {
          id: 'rental-a',
          clientId: 'client-a',
          startsAt: new Date('2026-08-16T08:00:00.000Z'),
          endsAt: new Date('2026-08-16T10:00:00.000Z'),
          distanceMs: 0,
          relativeToOffense: 'DURING',
        },
      ],
    });
  });

  it('does not guess when rentals overlap', () => {
    const rentals = ['a', 'b'].map((id) => ({
      id,
      clientId: `client-${id}`,
      startsAt: new Date('2026-08-16T08:00:00.000Z'),
      endsAt: new Date('2026-08-16T10:00:00.000Z'),
    }));
    expect(selectFineAttribution(offenseAt, rentals)).toMatchObject({
      kind: 'AMBIGUOUS',
      candidates: [
        expect.objectContaining({ id: 'a', distanceMs: 0, relativeToOffense: 'DURING' }),
        expect.objectContaining({ id: 'b', distanceMs: 0, relativeToOffense: 'DURING' }),
      ],
    });
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
    ).toMatchObject({
      kind: 'UNMATCHED',
      candidates: [
        expect.objectContaining({ id: 'ended', distanceMs: 0, relativeToOffense: 'BEFORE' }),
      ],
    });
  });

  it('returns only the five nearest rentals inside the 72-hour review window', () => {
    const rentals = [1, 2, 3, 4, 5, 6, 73].map((hours) => ({
      id: `after-${hours}`,
      clientId: `client-${hours}`,
      startsAt: new Date(offenseAt.getTime() + hours * 60 * 60 * 1000),
      endsAt: new Date(offenseAt.getTime() + (hours + 1) * 60 * 60 * 1000),
    }));

    expect(selectFineAttribution(offenseAt, rentals)).toEqual({
      kind: 'UNMATCHED',
      candidates: [1, 2, 3, 4, 5].map((hours) => ({
        ...rentals[hours - 1],
        distanceMs: hours * 60 * 60 * 1000,
        relativeToOffense: 'AFTER',
      })),
    });
  });

  it('sorts before and after hints by absolute interval distance without matching them', () => {
    const before = {
      id: 'before',
      clientId: 'client-before',
      startsAt: new Date('2026-08-16T06:00:00.000Z'),
      endsAt: new Date('2026-08-16T09:00:00.000Z'),
    };
    const after = {
      id: 'after',
      clientId: 'client-after',
      startsAt: new Date('2026-08-16T09:45:00.000Z'),
      endsAt: new Date('2026-08-16T11:00:00.000Z'),
    };

    expect(selectFineAttribution(offenseAt, [before, after])).toEqual({
      kind: 'UNMATCHED',
      candidates: [
        { ...after, distanceMs: 15 * 60 * 1000, relativeToOffense: 'AFTER' },
        { ...before, distanceMs: 30 * 60 * 1000, relativeToOffense: 'BEFORE' },
      ],
    });
  });
});
