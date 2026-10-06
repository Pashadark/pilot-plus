import type { ClientListRentalSummary } from '../types';

type DepositTone = 'neutral' | 'warning' | 'success' | 'danger';

const statusView: Record<
  NonNullable<ClientListRentalSummary['depositStatus']>,
  { label: string; tone: DepositTone }
> = {
  NOT_COLLECTED: { label: 'Не возвращён', tone: 'neutral' },
  COLLECTED: { label: 'Не возвращён', tone: 'warning' },
  RETURNED: { label: 'Возвращён', tone: 'success' },
  PARTIALLY_WITHHELD: { label: 'Не возвращён', tone: 'warning' },
  WITHHELD: { label: 'Не возвращён', tone: 'danger' },
};

export function formatDepositReturnDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(new Date(value));
}

export function formatMinorMoney(value: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(BigInt(value)) / 100);
}

export function presentClientDeposit(
  rental: ClientListRentalSummary | null,
  _isCurrent: boolean,
): { amount: string; label: string; tone: DepositTone; returnedAtLabel: string } {
  if (!rental?.depositMinor || BigInt(rental.depositMinor) === BigInt(0)) {
    return { amount: 'Нет депозита', label: '', tone: 'neutral', returnedAtLabel: '—' };
  }

  const status = rental.depositStatus
    ? statusView[rental.depositStatus]
    : {
        label: 'Статус не отмечен',
        tone: 'warning' as const,
      };

  return {
    amount: formatMinorMoney(rental.depositMinor),
    label: status.label,
    tone: status.tone,
    returnedAtLabel: formatDepositReturnDate(rental.depositReturnedAt),
  };
}

export function clientRentalColor(
  rental: ClientListRentalSummary | null,
  isCurrent: boolean,
): 'neutral' | 'success' | 'primary' | 'warning' {
  if (!rental) return 'neutral';
  if (isCurrent) return 'success';
  if (!rental.depositMinor || BigInt(rental.depositMinor) === BigInt(0)) return 'primary';
  if (
    rental.depositStatus === 'RETURNED' ||
    rental.depositStatus === 'PARTIALLY_WITHHELD' ||
    rental.depositStatus === 'WITHHELD' ||
    rental.depositStatus === 'NOT_COLLECTED'
  ) {
    return 'primary';
  }
  return 'warning';
}
