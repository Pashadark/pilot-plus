import { describe, expect, it } from 'vitest';
import { getDashboardWindow, parseDashboardPeriod, parseDashboardSelection } from './date-window';

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
    expect(getDashboardWindow('month', now)).toMatchObject({
      from: new Date('2026-07-31T21:00:00.000Z'),
      toExclusive: new Date('2026-08-31T21:00:00.000Z'),
      label: 'Месяц',
    });
  });

  it('falls back to today for unknown input', () => {
    expect(parseDashboardPeriod('month')).toBe('month');
    expect(parseDashboardPeriod('quarter')).toBe('today');
    expect(parseDashboardPeriod(undefined)).toBe('today');
  });

  it('parses one custom Moscow calendar day', () => {
    expect(parseDashboardSelection({ from: '2026-08-10' }, now)).toMatchObject({
      key: 'custom',
      from: new Date('2026-08-09T21:00:00.000Z'),
      toExclusive: new Date('2026-08-10T21:00:00.000Z'),
      label: '10.08.2026',
    });
  });

  it('parses an inclusive custom range and rejects reversed dates', () => {
    expect(parseDashboardSelection({ from: '2026-08-10', to: '2026-08-12' }, now)).toMatchObject({
      key: 'custom',
      from: new Date('2026-08-09T21:00:00.000Z'),
      toExclusive: new Date('2026-08-12T21:00:00.000Z'),
      label: '10.08.2026 — 12.08.2026',
    });
    expect(parseDashboardSelection({ from: '2026-08-12', to: '2026-08-10' }, now).key).toBe(
      'today',
    );
  });
});
