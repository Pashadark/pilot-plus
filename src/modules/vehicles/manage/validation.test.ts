import { describe, expect, it } from 'vitest';

import { normalizeRegistrationNumber, normalizeVin, vehicleInputSchema } from './validation';

const validInput = {
  companyId: 'company-1',
  internalNumber: 'RNT-001',
  make: 'Kia',
  model: "Cee'd",
  registrationNumber: 'а 429 ау-97',
  vin: '  xw8zzznz8vg000001  ',
  year: '2020',
  city: 'Москва',
  transmission: 'АКПП',
  fuelType: 'PETROL',
  seats: '5',
  dailyPriceRubles: '3 500,50',
  depositRubles: '10000.00',
  isRentalReady: 'true',
  status: 'UNKNOWN',
};

describe('валидация управления автопарком', () => {
  it('нормализует русские и латинские омографы государственного номера', () => {
    expect(normalizeRegistrationNumber('а 429 ау 97')).toBe('А429АУ97');
    expect(normalizeRegistrationNumber('A429AY97')).toBe('А429АУ97');
  });

  it('отклоняет невозможный формат государственного номера', () => {
    expect(() => normalizeRegistrationNumber('А42АУ97')).toThrow('государственного номера');
    expect(() => normalizeRegistrationNumber('ZZ999ZZ77')).toThrow('государственного номера');
  });

  it('нормализует VIN ровно как database trigger: trim и uppercase', () => {
    expect(normalizeVin('  xw8-zzznz8vg000001  ')).toBe('XW8-ZZZNZ8VG000001');
    expect(normalizeVin('   ')).toBeNull();
  });

  it('безопасно преобразует десятичные рубли в BigInt minor units', () => {
    const result = vehicleInputSchema.parse(validInput);

    expect(result.registrationNumberNormalized).toBe('А429АУ97');
    expect(result.vinNormalized).toBe('XW8ZZZNZ8VG000001');
    expect(result.dailyPriceMinor).toBe(350050);
    expect(result.depositMinor).toBe(BigInt(1_000_000));
  });

  it('не округляет небезопасные денежные значения через JavaScript number', () => {
    const result = vehicleInputSchema.parse({
      ...validInput,
      depositRubles: '9007199254740992.01',
    });

    expect(result.depositMinor).toBe(BigInt('900719925474099201'));
  });

  it('выдаёт field error для дробного значения с более чем двумя знаками', () => {
    const result = vehicleInputSchema.safeParse({ ...validInput, depositRubles: '1.999' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.depositRubles).toBeTruthy();
  });
});
