import { describe, expect, it } from 'vitest';

import { calculateExtensionCharges, calculateReturnCharges } from './calculation';

describe('rental operation calculations', () => {
  it('calculates extension days and surcharge with bigint-safe arithmetic', () => {
    expect(
      calculateExtensionCharges({
        previousEndsAt: new Date('2026-08-21T09:00:00Z'),
        nextEndsAt: new Date('2026-08-23T09:00:00Z'),
        dailyRateMinor: 470_000,
      }),
    ).toEqual({ additionalDays: 2, extensionChargeMinor: 940_000 });
  });

  it('calculates mileage and missing-fuel charges independently', () => {
    expect(
      calculateReturnCharges({
        handoverMileageKm: 10_000,
        returnMileageKm: 10_950,
        billableDays: 3,
        includedMileageKmPerDay: 250,
        overageMileagePriceMinor: 2_000,
        handoverFuelLevelPercent: 80,
        returnFuelLevelPercent: 55,
        missingFuelPriceMinor: 5_000,
      }),
    ).toEqual({
      drivenKm: 950,
      includedMileageKm: 750,
      overageMileageKm: 200,
      mileageChargeMinor: 400_000,
      missingFuelPercent: 25,
      fuelChargeMinor: 125_000,
      totalChargeMinor: 525_000,
    });
  });

  it('rejects unsafe or decreasing measurements', () => {
    expect(() =>
      calculateReturnCharges({
        handoverMileageKm: 100,
        returnMileageKm: 99,
        billableDays: 1,
        includedMileageKmPerDay: 0,
        overageMileagePriceMinor: 0,
        handoverFuelLevelPercent: 50,
        returnFuelLevelPercent: 50,
        missingFuelPriceMinor: 0,
      }),
    ).toThrow('Пробег при возврате');
  });
});
