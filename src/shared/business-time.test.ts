import { describe, expect, it } from 'vitest';

import { parsePilotDateTimeLocal } from './business-time';

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
