import { normalizeRegistrationNumber } from '@/modules/vehicles/manage/validation';

import type { z } from 'zod';
import type { driverHelperCarSchema, driverHelperFineSchema } from './schemas';

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

function providerDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/u.test(normalized) ? normalized : `${normalized}+03:00`,
  );
  if (Number.isNaN(date.valueOf())) throw new Error('Некорректная дата штрафа.');
  return date;
}

export function normalizeDriverHelperFine(fine: z.infer<typeof driverHelperFineSchema>) {
  const vehicle = fine.car ? normalizeDriverHelperCar(fine.car) : null;
  return {
    externalId: String(fine.id),
    decreeNumber: fine.post_mum?.trim() || fine.post_num?.trim() || String(fine.id),
    decreeAt: providerDate(fine.post_date),
    offenseAt: providerDate(fine.fine_date) as Date,
    discountExpiresAt: providerDate(fine.discount_date),
    originalAmountMinor: parseRublesToMinor(fine.total_suma),
    currentAmountMinor: parseRublesToMinor(fine.suma),
    discountPercent: fine.discount_size ?? null,
    articleCode: fine.koap_code?.trim() || null,
    description: fine.koap_text?.trim() || null,
    address: fine.address?.trim() || null,
    status: fine.cancelled ? 'CANCELLED' : fine.paid ? 'PAID' : 'UNPAID',
    toBailiff: fine.to_bailiff,
    photoState: fine.photo_urls?.length ? 'AVAILABLE' : null,
    providerVehicleId: vehicle?.externalId ?? null,
  } as const;
}
