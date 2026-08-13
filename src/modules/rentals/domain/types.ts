export type RentalStatus = 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type AvailabilityReason = 'ARCHIVED' | 'NOT_RENTAL_READY' | 'MAINTENANCE' | 'RENTAL_OVERLAP';

export interface RentalCalculationInput {
  startsAt: Date;
  endsAt: Date;
  dailyMinor: number;
  discountMinor?: number;
  serviceMinor?: number;
  agreedTotalMinor?: number;
}
export interface RentalCalculation {
  days: number;
  calculatedTotalMinor: number;
  agreedTotalMinor: number;
  discountMinor: number;
  servicesMinor: number;
  warnings: string[];
}
export interface RentalInterval {
  startsAt: Date;
  endsAt: Date;
  status: RentalStatus;
}
