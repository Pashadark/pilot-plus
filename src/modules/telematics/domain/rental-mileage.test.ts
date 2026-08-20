import { describe, expect, it } from 'vitest';

import { calculateRentalMileage } from './rental-mileage';

describe('пробег аренды', () => {
  it('использует подписанный пробег возврата и считает превышение лимита', () => {
    expect(
      calculateRentalMileage({
        issueTenths: 100_000,
        returnTenths: 108_500,
        liveTenths: 109_000,
        includedKmPerDay: 300,
        billableDays: 2,
      }),
    ).toEqual({
      drivenTenths: 8_500,
      includedTenths: 6_000,
      overageTenths: 2_500,
      source: 'RETURN',
    });
  });

  it('до возврата использует телеметрию как предварительную и не даёт отрицательный перерасход', () => {
    expect(
      calculateRentalMileage({
        issueTenths: 100_000,
        returnTenths: null,
        liveTenths: 101_500,
        includedKmPerDay: 300,
        billableDays: 1,
      }),
    ).toEqual({
      drivenTenths: 1_500,
      includedTenths: 3_000,
      overageTenths: 0,
      source: 'LIVE',
    });
  });

  it('отклоняет откат одометра и небезопасные числа', () => {
    expect(() =>
      calculateRentalMileage({
        issueTenths: 100_000,
        returnTenths: 99_000,
        liveTenths: null,
        includedKmPerDay: 300,
        billableDays: 1,
      }),
    ).toThrow('Пробег возврата меньше пробега выдачи.');
    expect(() =>
      calculateRentalMileage({
        issueTenths: Number.MAX_SAFE_INTEGER,
        returnTenths: null,
        liveTenths: null,
        includedKmPerDay: 300,
        billableDays: 1,
      }),
    ).toThrow('Некорректный пробег аренды.');
  });
});
