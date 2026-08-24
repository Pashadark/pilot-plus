export type DashboardPeriod = 'today' | 'tomorrow' | 'day-after-tomorrow' | 'week';

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Сегодня',
  tomorrow: 'Завтра',
  'day-after-tomorrow': 'Послезавтра',
  week: 'Неделя',
};

const PERIOD_OFFSETS: Record<DashboardPeriod, number> = {
  today: 0,
  tomorrow: 1,
  'day-after-tomorrow': 2,
  week: 0,
};

function moscowCalendarDate(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Europe/Moscow',
    year: 'numeric',
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function startOfMoscowDay(now: Date, offsetDays: number): Date {
  const { year, month, day } = moscowCalendarDate(now);
  return new Date(Date.UTC(year, month - 1, day + offsetDays, -3));
}

export function parseDashboardPeriod(value: string | undefined): DashboardPeriod {
  if (
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'day-after-tomorrow' ||
    value === 'week'
  ) {
    return value;
  }

  return 'today';
}

export function getDashboardWindow(
  period: DashboardPeriod,
  now: Date = new Date(),
): { from: Date; toExclusive: Date; label: string } {
  const from = startOfMoscowDay(now, PERIOD_OFFSETS[period]);
  const dayCount = period === 'week' ? 7 : 1;
  const toExclusive = new Date(from.getTime() + dayCount * 24 * 60 * 60 * 1000);

  return { from, toExclusive, label: PERIOD_LABELS[period] };
}
