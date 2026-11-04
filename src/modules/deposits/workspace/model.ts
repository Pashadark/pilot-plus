import { projectDepositBalance } from '@/modules/deposits/domain/balance';

export type DepositWorkspaceStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'SOON'
  | 'TODAY'
  | 'OVERDUE'
  | 'DEBT'
  | 'RETURNED'
  | 'RETURNED_WITH_WITHHOLDING'
  | 'WITHHELD';

export type DepositWorkspaceFilter = 'all' | 'urgent' | 'soon' | 'active' | 'returned' | 'debt';

export interface DepositWorkspaceRental {
  id: string;
  companyId: string;
  contractNumber: string | null;
  status: string;
  endsAt: Date;
  completedAt: Date | null;
  depositMinor: bigint | null;
  currency: string;
  client: { id: string; firstName: string; middleName: string | null; lastName: string };
  vehicle: {
    make: string | null;
    model: string;
    modelName: string | null;
    registrationNumber: string | null;
  };
  depositLedgerEntries: Array<{
    id: string;
    kind: string;
    reason: string | null;
    cashDeltaMinor: bigint;
    reservedDeltaMinor: bigint;
    withheldDeltaMinor: bigint;
    debtDeltaMinor: bigint;
    occurredAt: Date;
  }>;
}

export interface DepositWorkspaceRow {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  vehicleName: string;
  registrationNumber: string;
  contractNumber: string;
  rentalStatus: string;
  currency: string;
  initialMinor: bigint;
  cashMinor: bigint;
  reservedMinor: bigint;
  withheldMinor: bigint;
  availableMinor: bigint;
  debtMinor: bigint;
  returnDueOn: string;
  status: DepositWorkspaceStatus;
  history: DepositWorkspaceRental['depositLedgerEntries'];
  searchText: string;
}

export interface DepositWorkspaceSummary {
  availableMinor: bigint;
  reservedMinor: bigint;
  withheldMinor: bigint;
  debtMinor: bigint;
  urgentCount: number;
}

const DAY_MS = 86_400_000;

function utcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12));
}

export function addBusinessDays(value: Date, count: number) {
  const date = utcDate(value);
  let added = 0;
  while (added < count) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

function statusFor(input: {
  rentalStatus: string;
  availableMinor: bigint;
  cashMinor: bigint;
  reservedMinor: bigint;
  withheldMinor: bigint;
  initialMinor: bigint;
  debtMinor: bigint;
  hasDepositReturn: boolean;
  dueOn: string;
  today: string;
}): DepositWorkspaceStatus {
  if (input.debtMinor > 0n) return 'DEBT';
  if (['ACTIVE', 'CONFIRMED'].includes(input.rentalStatus)) return 'ACTIVE';
  if (input.hasDepositReturn && input.availableMinor === 0n && input.reservedMinor === 0n) {
    if (input.withheldMinor > 0n && input.withheldMinor >= input.initialMinor) return 'WITHHELD';
    if (input.withheldMinor > 0n) return 'RETURNED_WITH_WITHHOLDING';
    return 'RETURNED';
  }
  if (input.cashMinor === 0n && input.availableMinor === 0n) return 'RETURNED';
  const distance = Math.round(
    (Date.parse(`${input.dueOn}T12:00:00.000Z`) - Date.parse(`${input.today}T12:00:00.000Z`)) /
      DAY_MS,
  );
  if (distance < 0) return 'OVERDUE';
  if (distance === 0) return 'TODAY';
  if (distance <= 3) return 'SOON';
  return 'PENDING';
}

function normalized(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/[\s\-–—._/\\]+/gu, '');
}

export function buildDepositWorkspace(
  rentals: readonly DepositWorkspaceRental[],
  referenceTime = new Date(),
) {
  const today = utcDate(referenceTime).toISOString().slice(0, 10);
  const rows: DepositWorkspaceRow[] = rentals.map((rental) => {
    const balance = projectDepositBalance(rental.depositLedgerEntries);
    const clientName = [rental.client.lastName, rental.client.firstName, rental.client.middleName]
      .filter(Boolean)
      .join(' ');
    const vehicleName = [rental.vehicle.make, rental.vehicle.modelName ?? rental.vehicle.model]
      .filter(Boolean)
      .join(' ');
    const registrationNumber = rental.vehicle.registrationNumber ?? '';
    const contractNumber = rental.contractNumber ?? 'Без номера';
    const returnDueOn = addBusinessDays(rental.completedAt ?? rental.endsAt, 21);
    const status = statusFor({
      rentalStatus: rental.status,
      availableMinor: balance.availableMinor,
      cashMinor: balance.cashMinor,
      reservedMinor: balance.reservedMinor,
      withheldMinor: balance.withheldMinor,
      initialMinor: rental.depositMinor ?? 0n,
      debtMinor: balance.debtMinor,
      hasDepositReturn: rental.depositLedgerEntries.some(
        (entry) => entry.kind === 'DEPOSIT_RETURN',
      ),
      dueOn: returnDueOn,
      today,
    });
    return {
      id: rental.id,
      companyId: rental.companyId,
      clientId: rental.client.id,
      clientName,
      vehicleName,
      registrationNumber,
      contractNumber,
      rentalStatus: rental.status,
      currency: rental.currency,
      initialMinor: rental.depositMinor ?? 0n,
      ...balance,
      returnDueOn,
      status,
      history: rental.depositLedgerEntries,
      searchText: normalized(
        [clientName, vehicleName, registrationNumber, contractNumber].join(' '),
      ),
    };
  });
  const summary = rows.reduce<DepositWorkspaceSummary>(
    (result, row) => ({
      availableMinor: result.availableMinor + row.availableMinor,
      reservedMinor: result.reservedMinor + row.reservedMinor,
      withheldMinor: result.withheldMinor + row.withheldMinor,
      debtMinor: result.debtMinor + row.debtMinor,
      urgentCount: result.urgentCount + (['OVERDUE', 'TODAY', 'SOON'].includes(row.status) ? 1 : 0),
    }),
    { availableMinor: 0n, reservedMinor: 0n, withheldMinor: 0n, debtMinor: 0n, urgentCount: 0 },
  );
  return { rows, summary };
}

export function filterDepositRows(
  rows: readonly DepositWorkspaceRow[],
  input: { query?: string; filter?: string },
) {
  const query = normalized(input.query ?? '');
  const filter: DepositWorkspaceFilter = ['urgent', 'soon', 'active', 'returned', 'debt'].includes(
    input.filter ?? '',
  )
    ? (input.filter as DepositWorkspaceFilter)
    : 'all';
  return rows.filter((row) => {
    if (query && !row.searchText.includes(query)) return false;
    if (filter === 'urgent') return ['OVERDUE', 'TODAY'].includes(row.status);
    if (filter === 'soon') return row.status === 'SOON';
    if (filter === 'active') return row.status === 'ACTIVE';
    if (filter === 'returned') {
      return ['RETURNED', 'RETURNED_WITH_WITHHOLDING', 'WITHHELD'].includes(row.status);
    }
    if (filter === 'debt') return row.status === 'DEBT';
    return true;
  });
}
