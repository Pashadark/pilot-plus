import { describe, expect, it } from 'vitest';

import { parseRentalTermsForm } from './update-rental-terms';

function validForm() {
  const data = new FormData();
  data.set('rentalId', 'rental-1');
  data.set('companyId', 'company-1');
  data.set('updatedAt', '2026-09-01T10:00:00.000Z');
  data.set('vehicleId', 'vehicle-2');
  data.set('startsAt', '2026-09-02T10:00');
  data.set('endsAt', '2026-09-05T10:00');
  data.set('dailyRateRub', '5000');
  data.set('discountRub', '1000');
  data.set('servicesRub', '500');
  data.set('depositRub', '15000');
  data.set('includedMileageKm', '200');
  data.set('overageMileagePriceRub', '10');
  data.set('missingFuelPriceRub', '150');
  data.set('pickupAddress', 'Москва');
  data.set('returnAddress', 'Москва');
  data.set('paymentTerms', 'Оплата картой');
  data.set('territory', 'РФ');
  data.set('allowedDrivers', 'Иванов И.И.');
  return data;
}

describe('parseRentalTermsForm', () => {
  it('строго разбирает редактируемые условия и копейки', () => {
    expect(parseRentalTermsForm(validForm())).toMatchObject({
      rentalId: 'rental-1',
      vehicleId: 'vehicle-2',
      dailyRateMinor: 500_000,
      discountMinor: 100_000,
      servicesMinor: 50_000,
      depositMinor: 1_500_000,
      includedMileageKm: 200,
      overageMileagePriceMinor: 1_000,
      missingFuelPriceMinor: 15_000,
      allowedDrivers: 'Иванов И.И.',
    });
  });

  it('отклоняет обратный период', () => {
    const data = validForm();
    data.set('endsAt', '2026-09-01T10:00');
    expect(() => parseRentalTermsForm(data)).toThrow('позже');
  });
});
