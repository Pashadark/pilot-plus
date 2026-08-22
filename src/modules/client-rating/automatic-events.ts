import type { ClientRatingReason } from './types';
import { isClientRatingReason } from './types';

type AutomaticRatingEventType =
  | 'CLEAN_RENTAL'
  | 'ON_TIME_RETURN'
  | 'CLEAN_RENTAL_STREAK'
  | 'LATE_RETURN'
  | 'UNPAID_CONFIRMED_FINE'
  | 'DAMAGE'
  | 'CONTRACT_VIOLATION';

export type AutomaticRatingEventInput = Readonly<{
  companyId: string;
  clientId: string;
  type: AutomaticRatingEventType;
  reason: ClientRatingReason;
  delta: number;
  idempotencyKey: string;
  rentalId?: string;
  fineId?: string;
  vehicleId?: string;
}>;

type AutomaticRatingEventTransaction = {
  clientRatingEvent: {
    createMany(args: {
      data: Array<AutomaticRatingEventInput & { source: 'AUTOMATIC'; actorUserId: null }>;
      skipDuplicates: true;
    }): Promise<{ count: number }>;
  };
};

export type FineRatingGate = Readonly<{
  assignment: 'CANDIDATE' | 'CONFIRMED';
  overdue: boolean;
}>;

export function createFineRatingInput(
  input: FineRatingGate,
): Readonly<Pick<AutomaticRatingEventInput, 'type' | 'reason' | 'delta'>> | null {
  if (input.assignment !== 'CONFIRMED' || !input.overdue) return null;
  return {
    type: 'UNPAID_CONFIRMED_FINE',
    reason: 'UNPAID_CONFIRMED_FINE',
    delta: -15,
  };
}

export async function recordAutomaticRatingEvent(
  transaction: AutomaticRatingEventTransaction,
  input: AutomaticRatingEventInput,
): Promise<boolean> {
  if (!isClientRatingReason(input.reason))
    throw new Error('Некорректная причина события рейтинга.');

  const result = await transaction.clientRatingEvent.createMany({
    data: [{ ...input, source: 'AUTOMATIC', actorUserId: null }],
    skipDuplicates: true,
  });
  return result.count === 1;
}
