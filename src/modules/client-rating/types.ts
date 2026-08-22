export const CLIENT_RATING_REASONS = [
  'CLEAN_RENTAL_COMPLETED',
  'ON_TIME_RETURN_COMPLETED',
  'CLEAN_RENTAL_STREAK_COMPLETED',
  'LATE_RETURN_CONFIRMED',
  'UNPAID_CONFIRMED_FINE',
  'DAMAGE_CONFIRMED',
  'CONTRACT_VIOLATION_CONFIRMED',
  'MANUAL_COMMENT',
] as const;

export type ClientRatingReason = (typeof CLIENT_RATING_REASONS)[number];

export type ClientRatingEvent = Readonly<{
  delta: number;
  reason: ClientRatingReason;
}>;

export type ClientRatingEventDelta = Pick<ClientRatingEvent, 'delta'>;

export function isClientRatingReason(value: string): value is ClientRatingReason {
  return (CLIENT_RATING_REASONS as readonly string[]).includes(value);
}

export type ClientRatingSummary = Readonly<{
  score: number;
  stars: number;
  display: string;
  label: string;
  completedRentals: number;
  eventCount: number;
}>;
