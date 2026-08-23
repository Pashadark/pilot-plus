export type RentalListLifecycle =
  'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'EXTENDED' | 'COMPLETED' | 'CANCELLED';

export type RentalListSource = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  contractNumber: string | null;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  currency: string;
  clientLabel: string;
  vehicleLabel: string;
  hasExtension: boolean;
  documentFormats: readonly string[];
};

const presentation = {
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  CONFIRMED: { label: 'Ожидает выдачи', tone: 'info' },
  ACTIVE: { label: 'Действует', tone: 'success' },
  EXTENDED: { label: 'Продлён', tone: 'warning' },
  COMPLETED: { label: 'Закрыт', tone: 'danger' },
  CANCELLED: { label: 'Отменён', tone: 'danger' },
} as const;

function money(value: bigint, currency: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) / 100);
}

export function presentRentalListRow(row: RentalListSource, now: Date) {
  const lifecycle = (
    row.status === 'ACTIVE' && row.hasExtension ? 'EXTENDED' : row.status
  ) as RentalListLifecycle;
  const view = presentation[lifecycle] ?? presentation.DRAFT;
  const endsAt = new Date(row.endsAt);
  const isOverdue = ['ACTIVE', 'EXTENDED'].includes(lifecycle) && endsAt < now;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' });
  const returnsToday = today.format(endsAt) === today.format(now);
  const priority = isOverdue
    ? 0
    : returnsToday
      ? 1
      : ['ACTIVE', 'EXTENDED'].includes(lifecycle)
        ? 2
        : lifecycle === 'CONFIRMED'
          ? 3
          : lifecycle === 'DRAFT'
            ? 4
            : 5;
  return {
    ...row,
    lifecycle,
    ...view,
    priority,
    total: money(row.totalPriceMinor, row.currency),
    deposit: row.depositMinor === null ? 'Не указан' : money(row.depositMinor, row.currency),
  };
}
