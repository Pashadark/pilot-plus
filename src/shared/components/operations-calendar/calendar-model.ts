import { getPilotBusinessDateParts, PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';

import type { CalendarDay, CalendarMonth, OperationsCalendarEvent } from './types';

const calendarMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const calendarInstantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const monthNameFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  timeZone: PILOT_BUSINESS_TIME_ZONE,
});

const businessYearFormatter = new Intl.DateTimeFormat('en-CA', {
  era: 'short',
  timeZone: PILOT_BUSINESS_TIME_ZONE,
  year: 'numeric',
});

const safeFallbackMonth = '1970-01';

const safeFallbackBusinessDate = {
  day: 1,
  isoDate: '1970-01-01',
  month: 1,
  monthValue: safeFallbackMonth,
  year: 1970,
};

function formatNumber(value: number) {
  return String(value).padStart(2, '0');
}

function formatYear(value: number) {
  if (value >= 0 && value <= 9999) {
    return String(value).padStart(4, '0');
  }

  const sign = value < 0 ? '-' : '+';
  return `${sign}${String(Math.abs(value)).padStart(6, '0')}`;
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${formatYear(year)}-${formatNumber(month)}-${formatNumber(day)}`;
}

function createUtcCalendarDate(year: number, monthIndex: number, day: number) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

function getNormalizedBusinessCurrentDate(now: Date) {
  if (Number.isNaN(now.getTime())) return safeFallbackBusinessDate;

  const { month, day } = getPilotBusinessDateParts(now);
  const parts = Object.fromEntries(
    businessYearFormatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const formattedYear = Number(parts.year);
  const year = parts.era === 'BC' ? 1 - formattedYear : formattedYear;

  if (year < 0 || year > 9999) return safeFallbackBusinessDate;

  return {
    day,
    isoDate: formatIsoDate(year, month, day),
    month,
    monthValue: `${formatYear(year)}-${formatNumber(month)}`,
    year,
  };
}

function formatCalendarLabel(year: number, month: number) {
  const date = createUtcCalendarDate(year, month - 1, 1);
  const monthName = monthNameFormatter.format(date);
  return `${monthName[0]?.toUpperCase() ?? ''}${monthName.slice(1)} ${year}`;
}

function getCalendarMonthParts(month: string) {
  return {
    year: Number(month.slice(0, 4)),
    month: Number(month.slice(5, 7)),
  };
}

function getCalendarGridBounds(year: number, month: number) {
  const firstDayOfMonth = createUtcCalendarDate(year, month - 1, 1);
  const lastDayOfMonth = createUtcCalendarDate(year, month, 0);
  const firstWeekday = (firstDayOfMonth.getUTCDay() + 6) % 7;
  const lastWeekday = (lastDayOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstDayOfMonth);
  const gridEnd = new Date(lastDayOfMonth);

  gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - lastWeekday));

  return { gridStart, gridEnd };
}

function parseCalendarInstant(value: string): Date | null {
  const match = calendarInstantPattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[7];

  if (
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59))
  ) {
    return null;
  }

  const calendarDate = createUtcCalendarDate(year, month - 1, day);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() + 1 !== month ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function parseCalendarMonth(value: string | null | undefined, now = new Date()) {
  const currentBusinessDate = getNormalizedBusinessCurrentDate(now);
  return value && calendarMonthPattern.test(value) ? value : currentBusinessDate.monthValue;
}

export function buildCalendarMonth(
  requestedMonth: string | null | undefined,
  now = new Date(),
): CalendarMonth {
  const currentBusinessDate = getNormalizedBusinessCurrentDate(now);
  const month =
    requestedMonth && calendarMonthPattern.test(requestedMonth)
      ? requestedMonth
      : currentBusinessDate.monthValue;
  const { year, month: monthNumber } = getCalendarMonthParts(month);
  const { gridStart, gridEnd } = getCalendarGridBounds(year, monthNumber);

  const today = currentBusinessDate.isoDate;
  const days: CalendarDay[] = [];

  for (const date = new Date(gridStart); date <= gridEnd; date.setUTCDate(date.getUTCDate() + 1)) {
    const isoDate = formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());

    days.push({
      isoDate,
      dayNumber: date.getUTCDate(),
      inCurrentMonth: date.getUTCFullYear() === year && date.getUTCMonth() + 1 === monthNumber,
      isToday: isoDate === today,
      events: [],
    });
  }

  return {
    month,
    label: formatCalendarLabel(year, monthNumber),
    days,
  };
}

export function groupCalendarEvents(events: readonly OperationsCalendarEvent[]) {
  const groups = new Map<
    string,
    Array<{ event: OperationsCalendarEvent; instantMs: number; position: number }>
  >();

  for (const [position, event] of events.entries()) {
    const startsAt = parseCalendarInstant(event.startsAt);
    if (!startsAt) continue;

    const { year, month, day } = getPilotBusinessDateParts(startsAt);
    const isoDate = formatIsoDate(year, month, day);
    const groupedEvents = groups.get(isoDate) ?? [];

    groupedEvents.push({ event, instantMs: startsAt.getTime(), position });
    groups.set(isoDate, groupedEvents);
  }

  return new Map(
    [...groups].map(([isoDate, groupedEvents]) => [
      isoDate,
      groupedEvents
        .sort((left, right) => left.instantMs - right.instantMs || left.position - right.position)
        .map(({ event }) => event),
    ]),
  );
}
