export type RentalDepositState =
  | 'NOT_COLLECTED'
  | 'COLLECTED'
  | 'RETURNED'
  | 'PARTIALLY_WITHHELD'
  | 'WITHHELD'
  | null;

type DepositOperation = {
  id: string;
  status: 'DRAFT' | 'COMMITTED' | 'ERROR';
  occurredAt: Date;
  depositStatus: Exclude<RentalDepositState, null> | null;
};

type DepositPayment = {
  kind: string;
  status: string;
  amountMinor: bigint;
};

export type RentalDepositStateInput = {
  expectedMinor: bigint | null;
  operations: readonly DepositOperation[];
  payments: readonly DepositPayment[];
};

export function resolveRentalDepositState(input: RentalDepositStateInput): RentalDepositState {
  if (!input.expectedMinor || input.expectedMinor <= BigInt(0)) return null;

  const latestOperation = [...input.operations]
    .filter((operation) => operation.status === 'COMMITTED' && operation.depositStatus !== null)
    .sort(
      (left, right) =>
        right.occurredAt.getTime() - left.occurredAt.getTime() ||
        right.id.localeCompare(left.id),
    )[0];

  if (latestOperation?.depositStatus) return latestOperation.depositStatus;

  const confirmedDepositMinor = input.payments
    .filter((payment) => payment.kind === 'DEPOSIT' && payment.status === 'CONFIRMED')
    .reduce((total, payment) => total + payment.amountMinor, BigInt(0));

  return confirmedDepositMinor >= input.expectedMinor ? 'COLLECTED' : null;
}
