const DAY_MS = 86_400_000;

function safeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} должен быть безопасным неотрицательным целым.`);
  return value;
}

function safeMoneyResult(value: bigint, label: string): number {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(`${label} выходит за допустимый диапазон.`);
  return Number(value);
}

export function calculateExtensionCharges(input: {
  previousEndsAt: Date;
  nextEndsAt: Date;
  dailyRateMinor: number;
}) {
  const previous = input.previousEndsAt.getTime();
  const next = input.nextEndsAt.getTime();
  if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(next) || next <= previous)
    throw new Error('Новая дата возврата должна быть позже текущей.');
  const additionalDays = Math.ceil((next - previous) / DAY_MS);
  const dailyRateMinor = safeNonNegativeInteger(input.dailyRateMinor, 'Суточный тариф');
  return {
    additionalDays,
    extensionChargeMinor: safeMoneyResult(
      BigInt(additionalDays) * BigInt(dailyRateMinor),
      'Доплата за продление',
    ),
  };
}

export function calculateReturnCharges(input: {
  handoverMileageKm: number;
  returnMileageKm: number;
  billableDays: number;
  includedMileageKmPerDay: number;
  overageMileagePriceMinor: number;
  handoverFuelLevelPercent: number;
  returnFuelLevelPercent: number;
  missingFuelPriceMinor: number;
}) {
  const handoverMileageKm = safeNonNegativeInteger(input.handoverMileageKm, 'Пробег при выдаче');
  const returnMileageKm = safeNonNegativeInteger(input.returnMileageKm, 'Пробег при возврате');
  if (returnMileageKm < handoverMileageKm)
    throw new Error('Пробег при возврате не может быть меньше пробега при выдаче.');
  const billableDays = safeNonNegativeInteger(input.billableDays, 'Количество дней');
  const includedPerDay = safeNonNegativeInteger(
    input.includedMileageKmPerDay,
    'Суточный лимит пробега',
  );
  const handoverFuel = safeNonNegativeInteger(input.handoverFuelLevelPercent, 'Топливо при выдаче');
  const returnFuel = safeNonNegativeInteger(input.returnFuelLevelPercent, 'Топливо при возврате');
  if (handoverFuel > 100 || returnFuel > 100)
    throw new Error('Уровень топлива должен быть от 0 до 100%.');

  const drivenKm = returnMileageKm - handoverMileageKm;
  const includedMileageKm = safeMoneyResult(
    BigInt(billableDays) * BigInt(includedPerDay),
    'Включённый пробег',
  );
  const overageMileageKm = Math.max(0, drivenKm - includedMileageKm);
  const mileageChargeMinor = safeMoneyResult(
    BigInt(overageMileageKm) *
      BigInt(safeNonNegativeInteger(input.overageMileagePriceMinor, 'Цена перепробега')),
    'Доплата за перепробег',
  );
  const missingFuelPercent = Math.max(0, handoverFuel - returnFuel);
  const fuelChargeMinor = safeMoneyResult(
    BigInt(missingFuelPercent) *
      BigInt(safeNonNegativeInteger(input.missingFuelPriceMinor, 'Цена недостающего топлива')),
    'Доплата за топливо',
  );
  const totalChargeMinor = safeMoneyResult(
    BigInt(mileageChargeMinor) + BigInt(fuelChargeMinor),
    'Итоговая доплата',
  );
  return {
    drivenKm,
    includedMileageKm,
    overageMileageKm,
    mileageChargeMinor,
    missingFuelPercent,
    fuelChargeMinor,
    totalChargeMinor,
  };
}
