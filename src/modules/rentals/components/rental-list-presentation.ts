export type RentalListLifecycle =
  'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'EXTENDED' | 'COMPLETED' | 'CANCELLED';

export type RentalListSource = {
  id: string;
  companyId?: string;
  clientId: string;
  vehicleId: string;
  status: string;
  agreementType?: 'STANDARD' | 'LEASE_TO_OWN';
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  contractNumber: string | null;
  dailyRateMinor: bigint;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  currency: string;
  clientLabel: string;
  clientPhone: string | null;
  vehicleName: string;
  registrationNumber: string;
  vehicleInternalNumber: string;
  vehicleCity: string;
  vehicleImage: { localPath: string; alt: string } | null;
  hasExtension: boolean;
  payments: readonly { kind: 'RENT' | 'DEPOSIT'; amountMinor: bigint }[];
  depositStatus:
    'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | null;
  depositWithheldMinor: bigint | null;
  documentFormats: readonly string[];
  documents: readonly { format: string; version: number }[];
};

export type RentalListPrimaryAction = 'CONTINUE' | 'HANDOVER' | 'EXTEND' | 'OPEN';
export type RentalListUrgency = 'overdue' | 'today' | 'soon' | 'normal' | 'closed';

const presentation = {
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  CONFIRMED: { label: 'Бронирование', tone: 'info' },
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

function boundedPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function relativeTimeLabel(endsAt: Date, now: Date, isOverdue: boolean) {
  const differenceMs = Math.abs(endsAt.getTime() - now.getTime());
  const hours = Math.max(1, Math.ceil(differenceMs / 3_600_000));
  const value = hours < 24 ? `${hours} ч` : `${Math.ceil(hours / 24)} дн.`;
  return isOverdue ? `Просрочено на ${value}` : `Осталось ${value}`;
}

function moscowCalendarDate(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), 12));
}

function depositReturnDeadline(value: string) {
  const date = moscowCalendarDate(value);
  let workingDays = 0;
  while (workingDays < 21) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) workingDays += 1;
  }
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function depositPresentation(row: RentalListSource, depositPaidMinor: bigint) {
  if (!row.depositMinor || row.depositMinor === BigInt(0)) {
    return { depositLabel: 'Без залога', depositTone: 'neutral' as const };
  }
  if (row.depositStatus === 'RETURNED') {
    return { depositLabel: 'Возвращён', depositTone: 'success' as const };
  }
  if (row.depositStatus === 'PARTIALLY_WITHHELD') {
    const withheld = row.depositWithheldMinor
      ? ` · удержано ${money(row.depositWithheldMinor, row.currency)}`
      : '';
    return { depositLabel: `Возвращён частично${withheld}`, depositTone: 'warning' as const };
  }
  if (row.depositStatus === 'WITHHELD') {
    return { depositLabel: 'Удержан', depositTone: 'danger' as const };
  }
  if (row.depositStatus === 'NOT_COLLECTED') {
    return { depositLabel: 'Не внесён', depositTone: 'neutral' as const };
  }
  if (row.depositStatus === 'COLLECTED' || depositPaidMinor > BigInt(0)) {
    const deadline = depositReturnDeadline(row.completedAt ?? row.endsAt);
    return { depositLabel: `Вернуть до ${deadline}`, depositTone: 'success' as const };
  }
  return { depositLabel: 'Не внесён', depositTone: 'warning' as const };
}

export function presentRentalListRow(row: RentalListSource, now: Date) {
  const isLeaseToOwn = row.agreementType === 'LEASE_TO_OWN';
  const lifecycle = (
    row.status === 'ACTIVE' && row.hasExtension ? 'EXTENDED' : row.status
  ) as RentalListLifecycle;
  const view = presentation[lifecycle] ?? presentation.DRAFT;
  const startsAt = new Date(row.startsAt);
  const endsAt = new Date(row.endsAt);
  const isOverdue = ['ACTIVE', 'EXTENDED'].includes(lifecycle) && endsAt < now;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' });
  const returnsToday = today.format(endsAt) === today.format(now);
  const isReturnDue = returnsToday && ['ACTIVE', 'EXTENDED'].includes(lifecycle);
  const durationMs = Math.max(1, endsAt.getTime() - startsAt.getTime());
  const progressPercent = boundedPercent(((now.getTime() - startsAt.getTime()) / durationMs) * 100);
  const remainingMs = endsAt.getTime() - now.getTime();
  const urgency: RentalListUrgency = isOverdue
    ? 'overdue'
    : isReturnDue
      ? 'today'
      : ['ACTIVE', 'EXTENDED'].includes(lifecycle) && remainingMs <= 48 * 3_600_000
        ? 'soon'
        : lifecycle === 'COMPLETED' || lifecycle === 'CANCELLED'
          ? 'closed'
          : 'normal';
  const paidMinor = row.payments
    .filter((payment) => payment.kind === 'RENT')
    .reduce((total, payment) => total + payment.amountMinor, BigInt(0));
  const depositPaidMinor = row.payments
    .filter((payment) => payment.kind === 'DEPOSIT')
    .reduce((total, payment) => total + payment.amountMinor, BigInt(0));
  const paymentPercent = row.contractNumber
    ? 100
    : row.totalPriceMinor > BigInt(0)
      ? boundedPercent((Number(paidMinor) / Number(row.totalPriceMinor)) * 100)
      : 100;
  const paymentLabel = row.contractNumber
    ? 'Оплачено'
    : paidMinor >= row.totalPriceMinor
      ? 'Оплачено'
      : paidMinor === BigInt(0)
        ? 'Не оплачено'
        : `${money(paidMinor, row.currency)} оплачено`;
  const primaryAction: RentalListPrimaryAction =
    lifecycle === 'DRAFT'
      ? 'CONTINUE'
      : lifecycle === 'CONFIRMED'
        ? 'HANDOVER'
        : lifecycle === 'ACTIVE' || lifecycle === 'EXTENDED'
          ? 'EXTEND'
          : 'OPEN';
  const remainingLabel =
    lifecycle === 'COMPLETED'
      ? 'Аренда завершена'
      : lifecycle === 'CANCELLED'
        ? 'Договор отменён'
        : lifecycle === 'DRAFT' || lifecycle === 'CONFIRMED'
          ? `Начало ${new Intl.DateTimeFormat('ru-RU', {
              timeZone: 'Europe/Moscow',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(startsAt)}`
          : relativeTimeLabel(endsAt, now, isOverdue);
  const depositView = depositPresentation(row, depositPaidMinor);
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
    isLeaseToOwn,
    agreementTypeLabel: isLeaseToOwn ? 'С правом выкупа' : 'Обычная аренда',
    lifecycle,
    ...(isOverdue
      ? { label: 'Просрочен', tone: 'danger' as const }
      : isReturnDue
        ? { label: 'Возврат сегодня', tone: 'warning' as const }
        : view),
    returnsToday: isReturnDue,
    urgency,
    priority,
    progressPercent,
    remainingLabel,
    paidMinor,
    paymentPercent,
    paymentLabel,
    primaryAction,
    ...depositView,
    total: money(row.totalPriceMinor, row.currency),
    dailyRate: `${money(row.dailyRateMinor, row.currency)}/сутки`,
    deposit: row.depositMinor === null ? 'Не указан' : money(row.depositMinor, row.currency),
  };
}
