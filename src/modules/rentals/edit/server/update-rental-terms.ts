import { calculateRental, moscowLocalToUtc } from '@/modules/rentals/domain/calculate-rental';

function required(data: FormData, key: string): string {
  const value = String(data.get(key) ?? '').trim();
  if (!value) throw new Error(`Заполните поле: ${key}.`);
  return value;
}

function money(data: FormData, key: string): number {
  const value = Number(required(data, key).replace(',', '.'));
  const minor = Math.round(value * 100);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Сумма указана неверно.');
  return minor;
}

function nonNegativeInteger(data: FormData, key: string): number {
  const value = Number(required(data, key));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Пробег указан неверно.');
  return value;
}

function bounded(data: FormData, key: string, max = 2000): string {
  const value = String(data.get(key) ?? '').trim();
  if (value.length > max) throw new Error('Текст слишком длинный.');
  return value;
}

export function parseRentalTermsForm(data: FormData) {
  const startsAt = moscowLocalToUtc(required(data, 'startsAt'));
  const endsAt = moscowLocalToUtc(required(data, 'endsAt'));
  if (endsAt <= startsAt) throw new Error('Дата возврата должна быть позже даты выдачи.');
  const updatedAt = new Date(required(data, 'updatedAt'));
  if (Number.isNaN(updatedAt.getTime())) throw new Error('Версия договора неверна.');
  return {
    rentalId: required(data, 'rentalId'),
    companyId: required(data, 'companyId'),
    updatedAt,
    vehicleId: required(data, 'vehicleId'),
    startsAt,
    endsAt,
    dailyRateMinor: money(data, 'dailyRateRub'),
    discountMinor: money(data, 'discountRub'),
    servicesMinor: money(data, 'servicesRub'),
    depositMinor: money(data, 'depositRub'),
    includedMileageKm: nonNegativeInteger(data, 'includedMileageKm'),
    overageMileagePriceMinor: money(data, 'overageMileagePriceRub'),
    missingFuelPriceMinor: money(data, 'missingFuelPriceRub'),
    pickupAddress: bounded(data, 'pickupAddress'),
    returnAddress: bounded(data, 'returnAddress'),
    paymentTerms: bounded(data, 'paymentTerms'),
    territory: bounded(data, 'territory'),
    allowedDrivers: bounded(data, 'allowedDrivers'),
  };
}

export function calculateEditedRental(value: ReturnType<typeof parseRentalTermsForm>) {
  return calculateRental({
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    dailyMinor: value.dailyRateMinor,
    discountMinor: value.discountMinor,
    serviceMinor: value.servicesMinor,
  });
}
