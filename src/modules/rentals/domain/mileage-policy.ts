export const STANDARD_DAILY_MILEAGE_LIMIT_KM = 200;

type RentalAgreementType = 'STANDARD' | 'LEASE_TO_OWN';

export function resolveRentalMileagePolicy(input: {
  agreementType: RentalAgreementType;
  billableDays: number;
  includedMileageKm?: number | null;
}) {
  const billableDays = Math.max(1, Math.trunc(input.billableDays));
  if (input.agreementType === 'LEASE_TO_OWN') {
    return { dailyLimitKm: null, totalLimitKm: null, billableDays } as const;
  }

  const dailyLimitKm =
    typeof input.includedMileageKm === 'number' && input.includedMileageKm > 0
      ? Math.trunc(input.includedMileageKm)
      : STANDARD_DAILY_MILEAGE_LIMIT_KM;

  return {
    dailyLimitKm,
    totalLimitKm: dailyLimitKm * billableDays,
    billableDays,
  } as const;
}
