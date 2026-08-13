import { describe, expect, it } from 'vitest';
import { intervalsOverlap, getAvailability } from './availability';

describe('rental availability', () => {
  it('uses half-open intervals and gives unavailability reasons', () => {
    const a = [new Date('2026-01-01T00:00Z'), new Date('2026-01-02T00:00Z')] as const;
    const b = [new Date('2026-01-02T00:00Z'), new Date('2026-01-03T00:00Z')] as const;
    expect(intervalsOverlap(a, b)).toBe(false);
    expect(
      getAvailability(
        {
          archived: false,
          rentalReady: true,
          status: 'UNKNOWN',
          rentals: [{ startsAt: a[0], endsAt: a[1], status: 'CONFIRMED' }],
        },
        b,
      ),
    ).toEqual({ available: true, reasons: [] });
    expect(
      getAvailability({ archived: true, rentalReady: false, status: 'MAINTENANCE', rentals: [] }, b)
        .reasons,
    ).toEqual(['ARCHIVED', 'NOT_RENTAL_READY', 'MAINTENANCE']);
  });
});
