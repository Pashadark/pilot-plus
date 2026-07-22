import { getPilotBusinessDateParts, PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';

import type { CalendarDay, CalendarMonth, OperationsCalendarEvent } from './types';

const calendarMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const calendarInstantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const monthNameFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  timeZone: PILOT_BUSINESS_TIME_ZONE,
});

function formatNumber(value: number) {
  return String(value).padStart(2, '0');
}

function formatYear(value: number) {
  return String(value).padStart(4, '0');
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

function getCurrentBusinessMonth(now: Date) {
  const { year, month } = getPilotBusinessDateParts(now);
  return `${year}-${formatNumber(month)}`;
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
  return value && calendarMonthPattern.test(value) ? value : getCurrentBusinessMonth(now);
}

export function buildCalendarMonth(
  requestedMonth: string | null | undefined,
  now = new Date(),
): CalendarMonth {
  const month = parseCalendarMonth(requestedMonth, now);
  const { year, month: monthNumber } = getCalendarMonthParts(month);
  const firstDayOfMonth = createUtcCalendarDate(year, monthNumber - 1, 1);
  const lastDayOfMonth = createUtcCalendarDate(year, monthNumber, 0);
  const firstWeekday = (firstDayOfMonth.getUTCDay() + 6) % 7;
  const lastWeekday = (lastDayOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstDayOfMonth);
  const gridEnd = new Date(lastDayOfMonth);

  gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - lastWeekday));

  const todayParts = getPilotBusinessDateParts(now);
  const today = formatIsoDate(todayParts.year, todayParts.month, todayParts.day);
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
