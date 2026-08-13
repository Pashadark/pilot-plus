import { describe, expect, it } from 'vitest';
import { parseRentalListMoscowBoundary } from './queries';

describe('parseRentalListMoscowBoundary', () => {
  it('rejects malformed dates and returns the exclusive next Moscow day', () => {
    expect(parseRentalListMoscowBoundary('2026-02-30')).toBeNull();
    expect(parseRentalListMoscowBoundary('2026/08/01')).toBeNull();
    expect(parseRentalListMoscowBoundary('2026-08-01', true)?.toISOString()).toBe(
      '2026-08-01T21:00:00.000Z',
    );
  });
});
