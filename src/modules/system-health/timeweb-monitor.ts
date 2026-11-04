import { formatTelegramMessage, telegramSection } from '@/modules/bot-api/telegram-message';

export const TIMEWEB_LOW_BALANCE_HOURS = 7 * 24;

export interface TimewebServerSummary {
  name: string;
  status: string;
}

export interface TimewebMonitorSnapshot {
  checkedAt: string;
  balance: number;
  currency: string;
  hourlyCost: number | null;
  dailyCost: number | null;
  monthlyCost: number | null;
  hoursLeft: number | null;
  depletesAt: string | null;
  autopayEnabled: boolean;
  discountPercent: number;
  discountEndsAt: string | null;
  alertActive: boolean;
  servers: TimewebServerSummary[];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown, minimum = 0): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum ? value : null;
}

function safeText(value: unknown, fallback: string, maximumLength: number) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maximumLength)
    : fallback;
}

function safeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function buildTimewebSnapshot(
  rawFinances: unknown,
  rawServers: unknown,
  previous: TimewebMonitorSnapshot | null,
  checkedAt: Date,
): TimewebMonitorSnapshot {
  const financeEnvelope = record(rawFinances);
  const finances = record(financeEnvelope?.finances);
  if (!finances) throw new Error('TIMEWEB_FINANCES_INVALID');

  const balance = finiteNumber(finances.total_balance) ?? finiteNumber(finances.balance);
  if (balance === null) throw new Error('TIMEWEB_FINANCES_INVALID');

  const hourlyCost = finiteNumber(finances.hourly_cost);
  const monthlyCost = finiteNumber(finances.monthly_cost);
  const hoursLeft = finiteNumber(finances.hours_left);
  const depletesAt =
    hoursLeft === null
      ? null
      : new Date(checkedAt.getTime() + hoursLeft * 60 * 60 * 1000).toISOString();
  const serverEnvelope = record(rawServers);
  const serverRows = Array.isArray(serverEnvelope?.servers) ? serverEnvelope.servers : [];
  const servers = serverRows.slice(0, 50).flatMap((value): TimewebServerSummary[] => {
    const server = record(value);
    if (!server) return [];
    return [
      {
        name: safeText(server.name, 'Сервер без названия', 100),
        status: safeText(server.status, 'unknown', 40),
      },
    ];
  });

  const isLow = hoursLeft !== null && hoursLeft <= TIMEWEB_LOW_BALANCE_HOURS;
  const alertActive =
    hoursLeft === null
      ? (previous?.alertActive ?? false)
      : isLow && (previous?.alertActive ?? false);

  return {
    checkedAt: checkedAt.toISOString(),
    balance,
    currency: safeText(finances.currency, 'RUB', 8).toUpperCase(),
    hourlyCost,
    dailyCost: hourlyCost === null ? null : hourlyCost * 24,
    monthlyCost,
    hoursLeft,
    depletesAt,
    autopayEnabled: record(finances.autopay_card_info) !== null,
    discountPercent: finiteNumber(finances.discount_percent) ?? 0,
    discountEndsAt: safeDate(finances.discount_end_date_at),
    alertActive,
    servers,
  };
}

export function shouldEnqueueTimewebAlert(
  previous: TimewebMonitorSnapshot | null,
  next: TimewebMonitorSnapshot,
) {
  return (
    next.hoursLeft !== null &&
    next.hoursLeft <= TIMEWEB_LOW_BALANCE_HOURS &&
    !(previous?.alertActive ?? false)
  );
}

function rubles(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function atMoscow(value: string | null) {
  if (!value) return 'Нет данных';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatTimewebAlert(snapshot: TimewebMonitorSnapshot) {
  const hours = Math.max(0, Math.floor(snapshot.hoursLeft ?? 0));
  const daily =
    snapshot.dailyCost === null ? 'Нет данных' : `${rubles(snapshot.dailyCost)} в сутки`;
  return formatTelegramMessage({
    title: '🔴 <b>Требуется пополнить сервер</b>',
    sections: [
      telegramSection('⚙️', 'Сервис', ['Timeweb']),
      telegramSection('💰', 'Баланс', [
        rubles(snapshot.balance),
        `Расход: ${daily}`,
        `Осталось: ${Math.floor(hours / 24)} дн. ${hours % 24} ч.`,
      ]),
      telegramSection('🗓', 'Прогноз отключения', [`${atMoscow(snapshot.depletesAt)} МСК`]),
    ],
    action: 'Пополнить баланс, чтобы сервер не остановился',
  });
}
