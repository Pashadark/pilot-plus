import { describe, expect, it } from 'vitest';

import { vehicleStatusLabel } from './park-status';

describe('vehicle park status', () => {
  it('показывает «В парке» только стоящей машине по адресу Зелёный проспект, 22', () => {
    expect(vehicleStatusLabel('IDLE', 'г. Москва, Зелёный проспект, д. 22')).toBe('В парке');
    expect(vehicleStatusLabel('IDLE', 'Москва, Зеленый проспект 22')).toBe('В парке');
    expect(vehicleStatusLabel('MOVING', 'Москва, Зеленый проспект 22')).toBe('В движении');
    expect(vehicleStatusLabel('IDLE', 'Москва, Зеленый проспект 220')).toBe('Стоит');
    expect(vehicleStatusLabel('IDLE', 'другой адрес')).toBe('Стоит');
  });
});
