import { describe, expect, it } from 'vitest';

import {
  normalizeDriverHelperCar,
  normalizeDriverHelperFine,
  parseRublesToMinor,
} from './normalizers';

describe('Driver Helper normalizers', () => {
  it.each([
    ['250', BigInt(25000)],
    ['250.5', BigInt(25050)],
    ['250,50', BigInt(25050)],
  ])('converts %s rubles to integer kopecks', (value, expected) => {
    expect(parseRublesToMinor(value)).toBe(expected);
  });

  it.each(['-1', '1e3', '1.234', '999999999999999999999999'])(
    'rejects unsafe money %s',
    (value) => {
      expect(() => parseRublesToMinor(value)).toThrow('Некорректная сумма');
    },
  );

  it('normalizes a provider car without preserving plaintext STS', () => {
    expect(
      normalizeDriverHelperCar({
        id: 42,
        title: 'Kia Cee’d',
        regnum: 'A 429 AY 97',
        stsnum: '12АА111222',
      }),
    ).toEqual({
      externalId: '42',
      title: 'Kia Cee’d',
      registrationNumberNormalized: 'А429АУ97',
      registrationCertificate: '12АА111222',
    });
  });

  it('normalizes a fine for local persistence and photo presentation', () => {
    expect(
      normalizeDriverHelperFine({
        id: 91,
        post_mum: '18810150210001234567',
        fine_date: '2026-08-16 12:30:00',
        post_date: '2026-08-17 09:00:00',
        suma: '250.00',
        total_suma: '500.00',
        discount_size: 50,
        discount_date: '2026-09-06 23:59:59',
        koap_code: '12.9.2',
        koap_text: 'Превышение скорости',
        address: 'Москва',
        paid: false,
        cancelled: false,
        to_bailiff: false,
        photo_urls: ['https://provider.invalid/private-photo'],
        car: { id: 7, regnum: 'A429AY97', stsnum: '12АА111222', title: 'Kia Cee’d' },
      }),
    ).toMatchObject({
      externalId: '91',
      decreeNumber: '18810150210001234567',
      originalAmountMinor: BigInt(50000),
      currentAmountMinor: BigInt(25000),
      status: 'UNPAID',
      photoState: 'AVAILABLE',
      providerVehicleId: '7',
    });
  });
});
