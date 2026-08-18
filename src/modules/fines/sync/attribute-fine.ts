export interface RentalCandidate {
  id: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface RankedRentalCandidate extends RentalCandidate {
  distanceMs: number;
  relativeToOffense: 'BEFORE' | 'DURING' | 'AFTER';
}

export type AttributionResult =
  | {
      kind: 'MATCHED';
      rentalId: string;
      clientId: string;
      candidates: readonly RankedRentalCandidate[];
    }
  | { kind: 'UNMATCHED'; candidates: readonly RankedRentalCandidate[] }
  | { kind: 'AMBIGUOUS'; candidates: readonly RankedRentalCandidate[] };

const candidateWindowMs = 72 * 60 * 60 * 1000;
const candidateLimit = 5;

function rankCandidate(offenseAt: Date, rental: RentalCandidate): RankedRentalCandidate {
  if (offenseAt < rental.startsAt) {
    return {
      ...rental,
      distanceMs: rental.startsAt.getTime() - offenseAt.getTime(),
      relativeToOffense: 'AFTER',
    };
  }
  if (offenseAt >= rental.endsAt) {
    return {
      ...rental,
      distanceMs: offenseAt.getTime() - rental.endsAt.getTime(),
      relativeToOffense: 'BEFORE',
    };
  }
  return { ...rental, distanceMs: 0, relativeToOffense: 'DURING' };
}

export function selectFineAttribution(
  offenseAt: Date,
  rentals: readonly RentalCandidate[],
): AttributionResult {
  const matches = rentals.filter(
    ({ startsAt, endsAt }) => startsAt <= offenseAt && offenseAt < endsAt,
  );
  const candidates = rentals
    .map((rental) => rankCandidate(offenseAt, rental))
    .filter(({ distanceMs }) => distanceMs <= candidateWindowMs)
    .sort(
      (left, right) =>
        left.distanceMs - right.distanceMs ||
        Number(left.relativeToOffense !== 'DURING') -
          Number(right.relativeToOffense !== 'DURING') ||
        left.startsAt.getTime() - right.startsAt.getTime() ||
        left.id.localeCompare(right.id),
    )
    .slice(0, candidateLimit);
  if (matches.length === 0) return { kind: 'UNMATCHED', candidates };
  if (matches.length > 1) return { kind: 'AMBIGUOUS', candidates };
  const match = matches[0];
  if (!match) return { kind: 'UNMATCHED', candidates };
  return { kind: 'MATCHED', rentalId: match.id, clientId: match.clientId, candidates };
}
