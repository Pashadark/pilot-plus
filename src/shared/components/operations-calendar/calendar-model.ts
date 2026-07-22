import { getPilotBusinessDateParts, PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';

import type { CalendarDay, CalendarMonth, OperationsCalendarEvent } from './types';

const calendarMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthNameFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  timeZone: PILOT_BUSINESS_TIME_ZONE,
});

function formatNumber(value: number) {
  return String(value).padStart(2, '0');
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${formatNumber(month)}-${formatNumber(day)}`;
}

function getCurrentBusinessMonth(now: Date) {
  const { year, month } = getPilotBusinessDateParts(now);
  return `${year}-${formatNumber(month)}`;
}

function formatCalendarLabel(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 1, 1));
  const monthName = monthNameFormatter.format(date);
  return `${monthName[0]?.toUpperCase() ?? ''}${monthName.slice(1)} ${year}`;
}

function getCalendarMonthParts(month: string) {
  return {
    year: Number(month.slice(0, 4)),
    month: Number(month.slice(5, 7)),
  };
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
  const firstDayOfMonth = new Date(Date.UTC(year, monthNumber - 1, 1));
  const lastDayOfMonth = new Date(Date.UTC(year, monthNumber, 0));
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
  const groups = new Map<string, OperationsCalendarEvent[]>();

  for (const event of events) {
    const startsAt = new Date(event.startsAt);
    if (Number.isNaN(startsAt.getTime())) continue;

    const { year, month, day } = getPilotBusinessDateParts(startsAt);
    const isoDate = formatIsoDate(year, month, day);
    const groupedEvents = groups.get(isoDate) ?? [];

    groupedEvents.push(event);
    groups.set(isoDate, groupedEvents);
  }

  for (const groupedEvents of groups.values()) {
    groupedEvents.sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  }

  return groups;
}
