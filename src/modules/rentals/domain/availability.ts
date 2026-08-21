import type { AvailabilityReason, RentalInterval } from './types';

export function intervalsOverlap(a: readonly [Date, Date], b: readonly [Date, Date]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}
export function getAvailability(
  vehicle: {
    archived: boolean;
    rentalReady: boolean;
    status: string;
    rentals: readonly RentalInterval[];
    maintenance?: readonly {
      startsAt: Date | null;
      endsAt: Date | null;
      status: string;
    }[];
  },
  period: readonly [Date, Date],
) {
  const reasons: AvailabilityReason[] = [];
  if (vehicle.archived) reasons.push('ARCHIVED');
  if (!vehicle.rentalReady) reasons.push('NOT_RENTAL_READY');
  if (vehicle.status === 'MAINTENANCE') reasons.push('MAINTENANCE');
  if (
    !reasons.includes('MAINTENANCE') &&
    vehicle.maintenance?.some(
      (record) =>
        (record.status === 'PLANNED' || record.status === 'IN_PROGRESS') &&
        record.startsAt &&
        record.endsAt &&
        intervalsOverlap([record.startsAt, record.endsAt], period),
    )
  )
    reasons.push('MAINTENANCE');
  if (
    vehicle.rentals.some(
      (r) =>
        (r.status === 'CONFIRMED' || r.status === 'ACTIVE') &&
        intervalsOverlap([r.startsAt, r.endsAt], period),
    )
  )
    reasons.push('RENTAL_OVERLAP');
  return { available: reasons.length === 0, reasons };
}

type AvailabilityVehicle = Parameters<typeof getAvailability>[0] & { id: string };

export function selectAvailableReplacementVehicles<T extends AvailabilityVehicle>(
  vehicles: readonly T[],
  period: readonly [Date, Date],
  limit = 5,
): T[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20)
    throw new Error('Лимит предложений некорректен.');
  return vehicles
    .filter((vehicle) => getAvailability(vehicle, period).available)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, limit);
}
