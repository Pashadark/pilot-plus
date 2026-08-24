import { describe, expect, it } from 'vitest';
import { getDashboardWindow, parseDashboardPeriod } from './date-window';

describe('dashboard date windows', () => {
  const now = new Date('2026-08-24T20:30:00.000Z'); // 23:30 Moscow

  it('uses Moscow midnight for today', () => {
    expect(getDashboardWindow('today', now)).toMatchObject({
      from: new Date('2026-08-23T21:00:00.000Z'),
      toExclusive: new Date('2026-08-24T21:00:00.000Z'),
    });
  });

  it('uses exact Moscow calendar-day offsets', () => {
    expect(getDashboardWindow('tomorrow', now)).toMatchObject({
      from: new Date('2026-08-24T21:00:00.000Z'),
      toExclusive: new Date('2026-08-25T21:00:00.000Z'),
    });
    expect(getDashboardWindow('day-after-tomorrow', now)).toMatchObject({
      from: new Date('2026-08-25T21:00:00.000Z'),
      toExclusive: new Date('2026-08-26T21:00:00.000Z'),
    });
    expect(getDashboardWindow('week', now)).toMatchObject({
      from: new Date('2026-08-23T21:00:00.000Z'),
      toExclusive: new Date('2026-08-30T21:00:00.000Z'),
    });
  });

  it('falls back to today for unknown input', () => {
    expect(parseDashboardPeriod('month')).toBe('today');
    expect(parseDashboardPeriod(undefined)).toBe('today');
  });
});
