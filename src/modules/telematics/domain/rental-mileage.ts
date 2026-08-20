export interface RentalMileageInput {
  issueTenths: number;
  returnTenths: number | null;
  liveTenths: number | null;
  includedKmPerDay: number;
  billableDays: number;
}

export interface RentalMileageResult {
  drivenTenths: number | null;
  includedTenths: number;
  overageTenths: number;
  source: 'RETURN' | 'LIVE' | 'NONE';
}

const MAX_ODOMETER_TENTHS = 100_000_000;

function validInteger(value: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

export function calculateRentalMileage(input: RentalMileageInput): RentalMileageResult {
  if (
    !validInteger(input.issueTenths, MAX_ODOMETER_TENTHS) ||
    !validInteger(input.includedKmPerDay, 100_000) ||
    !validInteger(input.billableDays, 10_000) ||
    (input.returnTenths !== null && !validInteger(input.returnTenths, MAX_ODOMETER_TENTHS)) ||
    (input.liveTenths !== null && !validInteger(input.liveTenths, MAX_ODOMETER_TENTHS))
  ) {
    throw new Error('Некорректный пробег аренды.');
  }

  const includedTenths = input.includedKmPerDay * input.billableDays * 10;
  if (!Number.isSafeInteger(includedTenths)) throw new Error('Некорректный пробег аренды.');

  const reading = input.returnTenths ?? input.liveTenths;
  const source =
    input.returnTenths !== null ? 'RETURN' : input.liveTenths !== null ? 'LIVE' : 'NONE';
  if (reading === null) return { drivenTenths: null, includedTenths, overageTenths: 0, source };
  if (reading < input.issueTenths) {
    throw new Error(
      source === 'RETURN'
        ? 'Пробег возврата меньше пробега выдачи.'
        : 'Текущий пробег меньше пробега выдачи.',
    );
  }

  const drivenTenths = reading - input.issueTenths;
  return {
    drivenTenths,
    includedTenths,
    overageTenths: Math.max(0, drivenTenths - includedTenths),
    source,
  };
}
