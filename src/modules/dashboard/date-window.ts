export type DashboardPeriod = 'today' | 'tomorrow' | 'day-after-tomorrow' | 'week' | 'month';
export type DashboardWindow = {
  key: DashboardPeriod | 'custom';
  from: Date;
  toExclusive: Date;
  label: string;
};

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Сегодня',
  tomorrow: 'Завтра',
  'day-after-tomorrow': 'Послезавтра',
  week: 'Неделя',
  month: 'Месяц',
};

const PERIOD_OFFSETS: Record<DashboardPeriod, number> = {
  today: 0,
  tomorrow: 1,
  'day-after-tomorrow': 2,
  week: 0,
  month: 0,
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
    value === 'week' ||
    value === 'month'
  ) {
    return value;
  }

  return 'today';
}

export function getDashboardWindow(
  period: DashboardPeriod,
  now: Date = new Date(),
): { from: Date; toExclusive: Date; label: string } {
  if (period === 'month') {
    const { year, month } = moscowCalendarDate(now);
    return {
      from: new Date(Date.UTC(year, month - 1, 1, -3)),
      toExclusive: new Date(Date.UTC(year, month, 1, -3)),
      label: PERIOD_LABELS[period],
    };
  }
  const from = startOfMoscowDay(now, PERIOD_OFFSETS[period]);
  const dayCount = period === 'week' ? 7 : 1;
  const toExclusive = new Date(from.getTime() + dayCount * 24 * 60 * 60 * 1000);

  return { from, toExclusive, label: PERIOD_LABELS[period] };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseMoscowDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day, -3));
  const check = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(result);
  return check === value ? result : null;
}

function formatCalendarDate(value: string): string {
  return value.split('-').reverse().join('.');
}

export function parseDashboardSelection(
  input: { period?: string; from?: string; to?: string },
  now: Date = new Date(),
): DashboardWindow {
  if (input.from) {
    const from = parseMoscowDate(input.from);
    const inclusiveTo = parseMoscowDate(input.to ?? input.from);
    if (from && inclusiveTo && inclusiveTo >= from) {
      const toExclusive = new Date(inclusiveTo.getTime() + 86_400_000);
      const fromLabel = formatCalendarDate(input.from);
      const toLabel = input.to ? formatCalendarDate(input.to) : null;
      return {
        key: 'custom',
        from,
        toExclusive,
        label: toLabel ? `${fromLabel} — ${toLabel}` : fromLabel,
      };
    }
  }
  const key = parseDashboardPeriod(input.period);
  return { key, ...getDashboardWindow(key, now) };
}
