export interface RentalCandidate {
  id: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
}

export type AttributionResult =
  | { kind: 'MATCHED'; rentalId: string; clientId: string }
  | { kind: 'UNMATCHED' }
  | { kind: 'AMBIGUOUS' };

export function selectFineAttribution(
  offenseAt: Date,
  rentals: readonly RentalCandidate[],
): AttributionResult {
  const matches = rentals.filter(
    ({ startsAt, endsAt }) => startsAt <= offenseAt && offenseAt < endsAt,
  );
  if (matches.length === 0) return { kind: 'UNMATCHED' };
  if (matches.length > 1) return { kind: 'AMBIGUOUS' };
  const match = matches[0];
  if (!match) return { kind: 'UNMATCHED' };
  return { kind: 'MATCHED', rentalId: match.id, clientId: match.clientId };
}
