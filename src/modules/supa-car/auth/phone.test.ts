import { describe, expect, it } from 'vitest';

import { normalizeOwnerPhone } from './phone';

describe('телефон владельца SUPA CAR', () => {
  it.each([
    ['+7 916 123-45-67', '+79161234567'],
    ['8 (916) 123 45 67', '+79161234567'],
    ['79161234567', '+79161234567'],
  ])('нормализует %s в единый российский E.164', (input, expected) => {
    expect(normalizeOwnerPhone(input)).toBe(expected);
  });

  it.each(['', '123', '+7 916 ABC 45 67', '+89161234567', '+791612345678'])(
    'отклоняет некорректный номер %s',
    (input) => {
      expect(() => normalizeOwnerPhone(input)).toThrow('Некорректный номер телефона.');
    },
  );
});
