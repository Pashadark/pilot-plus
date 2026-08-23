import type { ClientListRentalSummary } from '../types';

type DepositTone = 'neutral' | 'warning' | 'success' | 'danger';

const statusView: Record<
  NonNullable<ClientListRentalSummary['depositStatus']>,
  { label: string; tone: DepositTone }
> = {
  NOT_COLLECTED: { label: 'Не внесён', tone: 'neutral' },
  COLLECTED: { label: 'Нужно вернуть', tone: 'warning' },
  RETURNED: { label: 'Возвращён', tone: 'success' },
  PARTIALLY_WITHHELD: { label: 'Удержан частично', tone: 'warning' },
  WITHHELD: { label: 'Удержан', tone: 'danger' },
};

function money(value: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(BigInt(value)) / 100);
}

export function presentClientDeposit(
  rental: ClientListRentalSummary | null,
  isCurrent: boolean,
): { amount: string; label: string; tone: DepositTone } {
  if (!rental?.depositMinor || BigInt(rental.depositMinor) === BigInt(0)) {
    return { amount: 'Нет депозита', label: '', tone: 'neutral' };
  }

  const status = rental.depositStatus
    ? statusView[rental.depositStatus]
    : {
        label: isCurrent ? 'Статус не отмечен' : 'Возврат не отмечен',
        tone: 'warning' as const,
      };

  return {
    amount: money(rental.depositMinor),
    label: isCurrent ? status.label : `Последний · ${status.label}`,
    tone: status.tone,
  };
}
