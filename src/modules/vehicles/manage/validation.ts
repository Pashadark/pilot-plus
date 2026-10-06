import { z } from 'zod';

const MAX_ENTITY_ID_LENGTH = 128;
const LICENSE_LETTERS = 'АВЕКМНОРСТУХ';
export const registrationNumberHomoglyphs: Readonly<Record<string, string>> = {
  A: 'А',
  B: 'В',
  C: 'С',
  E: 'Е',
  H: 'Н',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  T: 'Т',
  X: 'Х',
  Y: 'У',
};
const registrationNumberPattern = new RegExp(
  `^[${LICENSE_LETTERS}]\\d{3}[${LICENSE_LETTERS}]{2}\\d{2,3}$`,
);
const decimalRublesPattern = /^\d+(?:[.,]\d{1,2})?$/;

function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function optionalText(max = 200) {
  return z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
}

function optionalInteger(min: number, max: number) {
  return z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional());
}

function optionalDecimal(min: number, max: number) {
  return z.preprocess(emptyToUndefined, z.coerce.number().min(min).max(max).optional());
}

function optionalDate() {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .transform((value) => new Date(`${value}T00:00:00.000Z`))
      .optional(),
  );
}

function moneyMinorSchema() {
  return z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, '').replace(',', '.'))
    .refine(
      (value) => decimalRublesPattern.test(value),
      'Укажите сумму в рублях с точностью до копеек.',
    )
    .transform(decimalRublesToMinor);
}

function optionalMoneyMinorSchema() {
  return z.preprocess(emptyToUndefined, moneyMinorSchema().optional());
}

export function decimalRublesToMinor(value: string): bigint {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!decimalRublesPattern.test(normalized)) {
    throw new Error('Сумма должна содержать не более двух знаков после запятой.');
  }
  const [rubles, fraction = ''] = normalized.split('.');
  return BigInt(rubles) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}

export function normalizeRegistrationNumber(value: string): string {
  const compact = value.toUpperCase().replace(/[\s-]/g, '');
  const normalized = Array.from(
    compact,
    (character) => registrationNumberHomoglyphs[character] ?? character,
  ).join('');
  if (!registrationNumberPattern.test(normalized)) {
    throw new Error('Укажите формат государственного номера А123АА77.');
  }
  return normalized;
}

/** Mirrors normalize_vehicle_vin in the database trigger: btrim + upper, no transliteration. */
export function normalizeVin(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized === '' ? null : normalized;
}

const registrationNumberSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, context) => {
    try {
      return normalizeRegistrationNumber(value);
    } catch {
      context.addIssue({ code: 'custom', message: 'Укажите корректный государственный номер.' });
      return z.NEVER;
    }
  });

const statusSchema = z.enum(['MOVING', 'IDLE', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN']);
const fuelTypeSchema = z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'OTHER']);
const driveTypeSchema = z.enum(['FRONT', 'REAR', 'ALL_WHEEL']);

export const vehicleInputSchema = z
  .object({
    companyId: z.string().trim().min(1).max(MAX_ENTITY_ID_LENGTH),
    internalNumber: z.string().trim().min(1).max(64),
    make: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(160),
    registrationNumber: registrationNumberSchema,
    vin: optionalText(128),
    year: z.coerce
      .number()
      .int()
      .min(1950)
      .max(new Date().getFullYear() + 1),
    color: optionalText(80),
    category: optionalText(80),
    bodyType: optionalText(80),
    transmission: z.string().trim().min(1).max(80),
    fuelType: fuelTypeSchema,
    seats: z.coerce.number().int().min(1).max(99),
    engineLiters: optionalDecimal(0, 99.9),
    driveType: z.preprocess(emptyToUndefined, driveTypeSchema.optional()),
    fuelConsumptionLitersPer100Km: optionalDecimal(0, 99.9),
    odometerKm: optionalDecimal(0, 999_999_999.9),
    fuelLevelPercent: optionalInteger(0, 100),
    valueRubles: optionalMoneyMinorSchema(),
    dailyPriceRubles: moneyMinorSchema(),
    rangePriceRubles: optionalMoneyMinorSchema(),
    depositRubles: optionalMoneyMinorSchema(),
    includedMileageKm: optionalInteger(0, 1_000_000),
    overageMileagePriceRubles: optionalMoneyMinorSchema(),
    missingFuelPriceRubles: optionalMoneyMinorSchema(),
    isRentalReady: z.preprocess((value) => value === 'true' || value === true, z.boolean()),
    city: z.string().trim().min(1).max(120),
    office: optionalText(120),
    status: statusSchema,
    registrationCertificateNumber: optionalText(160),
    vehiclePassportNumber: optionalText(160),
    osagoInsurer: optionalText(160),
    osagoPolicyNumber: optionalText(160),
    osagoStartsAt: optionalDate(),
    osagoEndsAt: optionalDate(),
    cascoInsurer: optionalText(160),
    cascoPolicyNumber: optionalText(160),
    cascoStartsAt: optionalDate(),
    cascoEndsAt: optionalDate(),
  })
  .strict()
  .transform((input, context) => {
    const dailyPriceMinorBigInt = input.dailyPriceRubles;
    if (dailyPriceMinorBigInt > BigInt(2_147_483_647)) {
      context.addIssue({
        code: 'custom',
        path: ['dailyPriceRubles'],
        message: 'Суточный тариф слишком велик.',
      });
      return z.NEVER;
    }
    const vinNormalized = normalizeVin(input.vin);
    return {
      ...input,
      registrationNumberNormalized: input.registrationNumber,
      vinNormalized,
      dailyPriceMinor: Number(dailyPriceMinorBigInt),
      valueMinor: input.valueRubles,
      rangePriceMinor: input.rangePriceRubles,
      depositMinor: input.depositRubles,
      overageMileagePriceMinor: input.overageMileagePriceRubles,
      missingFuelPriceMinor: input.missingFuelPriceRubles,
    };
  });

export const vehicleIdSchema = z.object({
  companyId: z.string().trim().min(1).max(MAX_ENTITY_ID_LENGTH),
  vehicleId: z.string().trim().min(1).max(MAX_ENTITY_ID_LENGTH),
});

export type VehicleInput = z.output<typeof vehicleInputSchema>;
