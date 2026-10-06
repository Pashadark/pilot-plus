import { describe, expect, it } from 'vitest';

import {
  addPilotBusinessDays,
  comparePilotBusinessDate,
  parsePilotDateTimeLocal,
} from './business-time';

describe('parsePilotDateTimeLocal', () => {
  it('interprets datetime-local as Europe/Moscow wall time', () => {
    expect(parsePilotDateTimeLocal('2026-07-22T10:00')?.toISOString()).toBe(
      '2026-07-22T07:00:00.000Z',
    );
  });

  it('rejects nonexistent calendar values', () => {
    expect(parsePilotDateTimeLocal('2026-02-30T10:00')).toBeNull();
    expect(parsePilotDateTimeLocal('2026-07-22T25:00')).toBeNull();
  });
});

describe('addPilotBusinessDays', () => {
  it('adds working days in Moscow time and skips weekends', () => {
    expect(addPilotBusinessDays(new Date('2026-09-04T10:00:00.000Z'), 1).toISOString()).toBe(
      '2026-09-07T10:00:00.000Z',
    );
  });

  it('calculates the 21-working-day deposit return deadline', () => {
    expect(addPilotBusinessDays(new Date('2026-08-24T17:00:00.000Z'), 21).toISOString()).toBe(
      '2026-09-22T17:00:00.000Z',
    );
  });
});

describe('comparePilotBusinessDate', () => {
  it('treats two instants on the same Moscow date as equal', () => {
    expect(
      comparePilotBusinessDate(
        new Date('2026-09-14T21:00:00.000Z'),
        new Date('2026-09-15T17:30:00.000Z'),
      ),
    ).toBe(0);
  });

  it('orders adjacent Moscow dates without comparing their clock time', () => {
    expect(
      comparePilotBusinessDate(
        new Date('2026-09-14T20:59:59.999Z'),
        new Date('2026-09-14T21:00:00.000Z'),
      ),
    ).toBe(-1);
  });
});
