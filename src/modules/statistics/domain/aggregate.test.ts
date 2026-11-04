import { describe, expect, it } from 'vitest';
import { aggregateStatistics, statisticsWindow } from './aggregate';

const from = new Date('2026-10-01T00:00:00+03:00');
const to = new Date('2026-10-08T00:00:00+03:00');
const base = { from, to, payments: [], rentals: [], costs: [], visits: [] };
describe('vehicle statistics', () => {
  it('counts only confirmed RUB rental receipts inside the half-open period', () => {
    const payment = {
      kind: 'RENT',
      status: 'CONFIRMED',
      currency: 'RUB',
      amountMinor: 10000n,
      recordedAt: from,
    };
    expect(
      aggregateStatistics({
        ...base,
        payments: [
          payment,
          { ...payment, kind: 'DEPOSIT' },
          { ...payment, status: 'REFUNDED' },
          { ...payment, status: 'PARTIALLY_REFUNDED' },
          { ...payment, currency: 'USD' },
          { ...payment, recordedAt: to },
          { ...payment, amountMinor: -100n },
        ],
      }),
    ).toMatchObject({ incomeMinor: 10000n, excludedPayments: 2 });
  });
  it('merges overlapping rentals and clips utilization to period boundaries', () => {
    const rental = {
      status: 'ACTIVE',
      startsAt: new Date('2026-09-30T00:00:00+03:00'),
      endsAt: new Date('2026-10-03T00:00:00+03:00'),
      operations: [],
    };
    expect(
      aggregateStatistics({
        ...base,
        rentals: [
          rental,
          { ...rental, startsAt: from, endsAt: new Date('2026-10-04T00:00:00+03:00') },
          { ...rental, status: 'CANCELLED', endsAt: to },
        ],
      }),
    ).toMatchObject({ utilizedDays: 3, utilizationPercent: 300 / 7 });
  });
  it('uses committed paired odometers only for returns in period and rejects negative mileage', () => {
    const rental = {
      status: 'COMPLETED',
      startsAt: from,
      endsAt: to,
      operations: [
        { type: 'HANDOVER', occurredAt: from, mileageKm: 100 },
        { type: 'RETURN', occurredAt: new Date('2026-10-03T00:00:00+03:00'), mileageKm: 450 },
      ],
    };
    expect(
      aggregateStatistics({
        ...base,
        rentals: [
          rental,
          {
            ...rental,
            operations: [
              { type: 'HANDOVER', occurredAt: from, mileageKm: 500 },
              rental.operations[1],
            ],
          },
          {
            ...rental,
            operations: [rental.operations[0], { ...rental.operations[1], occurredAt: to }],
          },
        ],
      }),
    ).toMatchObject({ rentalKm: 350, distanceCoveredRentals: 1, returnedRentals: 2 });
  });
  it('counts costs and weekdays in Moscow and does not inflate repeated visits', () => {
    const visit = { id: 'visit-1', enteredAt: from, latitude: 56, longitude: 93, name: 'АЗС' };
    const result = aggregateStatistics({
      ...base,
      costs: [
        { costMinor: 400n, completedAt: from },
        { costMinor: 600n, completedAt: to },
      ],
      rentals: [
        {
          status: 'COMPLETED',
          startsAt: new Date('2026-09-30T22:00:00Z'),
          endsAt: to,
          operations: [],
        },
      ],
      visits: [visit, visit],
    });
    expect(result).toMatchObject({
      costMinor: 400n,
      weekdays: [0, 0, 0, 1, 0, 0, 0],
      visitCount: 1,
    });
  });
  it('bounds periods and interprets business dates independently of server timezone', () => {
    expect(statisticsWindow('7', new Date('2026-10-09T22:00:00Z'))).toEqual({
      days: 7,
      from: new Date('2026-10-04T00:00:00+03:00'),
      to: new Date('2026-10-11T00:00:00+03:00'),
    });
    expect(statisticsWindow('9999', new Date('2026-10-09T12:00:00Z'))).toMatchObject({ days: 30 });
  });
});
