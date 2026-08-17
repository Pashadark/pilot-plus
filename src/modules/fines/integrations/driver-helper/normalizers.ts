import { normalizeRegistrationNumber } from '@/modules/vehicles/manage/validation';

import type { z } from 'zod';
import type { driverHelperCarSchema } from './schemas';

const MONEY_PATTERN = /^\d{1,15}(?:[.,]\d{1,2})?$/u;

export function parseRublesToMinor(value: string | number): bigint {
  const normalized = String(value).trim().replace(',', '.');
  if (!MONEY_PATTERN.test(normalized)) throw new Error('Некорректная сумма штрафа.');
  const [rubles, kopecks = ''] = normalized.split('.');
  return BigInt(rubles) * BigInt(100) + BigInt(kopecks.padEnd(2, '0'));
}

export function normalizeDriverHelperCar(car: z.infer<typeof driverHelperCarSchema>) {
  let registrationNumberNormalized: string | null = null;
  if (car.regnum?.trim()) {
    try {
      registrationNumberNormalized = normalizeRegistrationNumber(car.regnum);
    } catch {
      registrationNumberNormalized = null;
    }
  }

  return {
    externalId: String(car.id),
    title: car.title.trim(),
    registrationNumberNormalized,
    registrationCertificate: car.stsnum?.trim() || null,
  };
}
