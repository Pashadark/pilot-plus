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
