import { describe, expect, it } from 'vitest';

import { resolveRentalMileagePolicy } from './mileage-policy';

describe('resolveRentalMileagePolicy', () => {
  it('ignores legacy custom values and applies 200 km per day to a standard rental', () => {
    expect(
      resolveRentalMileagePolicy({
        agreementType: 'STANDARD',
        billableDays: 5,
        includedMileageKm: 1_000,
      }),
    ).toEqual({
      dailyLimitKm: 200,
      totalLimitKm: 1_000,
      billableDays: 5,
    });
  });

  it('keeps lease-to-own rentals unlimited', () => {
    expect(
      resolveRentalMileagePolicy({
        agreementType: 'LEASE_TO_OWN',
        billableDays: 30,
        includedMileageKm: 1_000,
      }),
    ).toEqual({
      dailyLimitKm: null,
      totalLimitKm: null,
      billableDays: 30,
    });
  });
});
