import { describe, expect, it } from 'vitest';

import { normalizeGlonassSoftPlate } from './normalizers';

describe('нормализация GLONASSSoft', () => {
  it.each([
    ['A156AX997', 'А156АХ997'],
    ['а 429 ау-997', 'А429АУ997'],
    ['H726AX550', 'Н726АХ550'],
  ])('приводит номер %s к %s', (input, expected) => {
    expect(normalizeGlonassSoftPlate(input)).toBe(expected);
  });

  it('отвергает строку без российского номера', () => {
    expect(() => normalizeGlonassSoftPlate('Volkswagen Polo')).toThrow('Госномер GLONASSSoft');
  });
});
