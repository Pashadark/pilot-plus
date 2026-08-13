import { describe, expect, it } from 'vitest';

import { calculateRental, moscowLocalToUtc } from './calculate-rental';

describe('rental calculation', () => {
  it('calculates paid 24-hour days from Moscow local timestamps as UTC instants', () => {
    const result = calculateRental({
      startsAt: moscowLocalToUtc('2026-08-12T12:00'),
      endsAt: moscowLocalToUtc('2026-08-13T12:01'),
      dailyMinor: 470_000,
      discountMinor: 10_000,
      serviceMinor: 20_000,
    });
    expect(result).toEqual({
      days: 2,
      calculatedTotalMinor: 950_000,
      agreedTotalMinor: 950_000,
      discountMinor: 10_000,
      servicesMinor: 20_000,
      warnings: [],
    });
  });

  it('rejects non-positive periods and unsafe money', () => {
    expect(() =>
      calculateRental({
        startsAt: new Date('2026-01-01T00:00Z'),
        endsAt: new Date('2026-01-01T00:00Z'),
        dailyMinor: 1,
      }),
    ).toThrow('позже');
    expect(() =>
      calculateRental({
        startsAt: new Date('2026-01-01T00:00Z'),
        endsAt: new Date('2026-01-02T00:00Z'),
        dailyMinor: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow('безопас');
  });

  it('rejects impossible Moscow calendar values and returns price breakdowns', () => {
    expect(() => moscowLocalToUtc('2026-02-30T12:00')).toThrow('календар');
    expect(
      calculateRental({
        startsAt: moscowLocalToUtc('2026-01-01T00:00'),
        endsAt: moscowLocalToUtc('2026-01-02T00:00'),
        dailyMinor: 100,
        discountMinor: 10,
        serviceMinor: 20,
      }),
    ).toMatchObject({ discountMinor: 10, servicesMinor: 20 });
  });
});
