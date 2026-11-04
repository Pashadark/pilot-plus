import { describe, expect, it } from 'vitest';

import { dateInputValue } from './rental-document-review';

describe('dateInputValue', () => {
  it('normalizes stored ISO timestamps for editable date fields', () => {
    expect(dateInputValue('1990-04-12T00:00:00.000Z')).toBe('1990-04-12');
    expect(dateInputValue('2030-01-01')).toBe('2030-01-01');
    expect(dateInputValue(null)).toBe('');
  });
});
