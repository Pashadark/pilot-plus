import { describe, it, expect } from 'vitest';
import { parseSearchQuery, normalizeSearchPlate } from './query';
describe('global search query', () => {
  it('parses Moscow dates and inclusive ranges', () => {
    expect(parseSearchQuery('22.09–25.09.2026').range).toEqual({
      from: '2026-09-21T21:00:00.000Z',
      to: '2026-09-25T21:00:00.000Z',
    });
    expect(parseSearchQuery('22.09.2026').range?.from).toBe('2026-09-21T21:00:00.000Z');
  });
  it('rejects invalid and reversed dates', () => {
    expect(parseSearchQuery('31.02.2026').error).toBeTruthy();
    expect(parseSearchQuery('25.09–22.09.2026').error).toBeTruthy();
  });
  it('keeps text and normalizes Latin plate letters', () => {
    expect(parseSearchQuery('CAR-011').text).toBe('CAR-011');
    expect(normalizeSearchPlate('p 400 am 997')).toBe('Р400АМ997');
  });
});
