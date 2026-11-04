import { describe, expect, it } from 'vitest';
import { calendarDays, dayKey, rentalPlacement } from './workday-calendar';
describe('workday calendar', () => {
  it('uses Moscow dates across a UTC day boundary', () => {
    expect(dayKey('2026-10-07T22:00:00Z')).toBe('2026-10-08');
    expect(calendarDays('2026-12-30')[2].key).toBe('2027-01-01');
  });
  it('clips rentals at week boundaries without inventing occupancy', () => {
    expect(
      rentalPlacement('2026-10-01T15:00:00Z', '2026-10-09T16:00:00Z', '2026-10-08', 7),
    ).toEqual({ start: 0, span: 2 });
    expect(
      rentalPlacement('2026-10-01T15:00:00Z', '2026-10-07T21:00:00Z', '2026-10-08', 7),
    ).toBeNull();
    expect(
      rentalPlacement('2026-10-08T21:00:00Z', '2026-10-09T21:00:00Z', '2026-10-08', 7),
    ).toEqual({ start: 1, span: 1 });
  });
});
