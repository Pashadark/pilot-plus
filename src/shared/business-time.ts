export const PILOT_BUSINESS_TIME_ZONE = 'Europe/Moscow';

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const pilotDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PILOT_BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function pilotParts(value: Date): DateParts {
  const parts = Object.fromEntries(
    pilotDateTimeFormatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function sameParts(left: DateParts, right: DateParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function parsePilotDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const requested: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
  const wallTimeMs = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute,
  );
  const calendarCheck = new Date(wallTimeMs);

  if (
    calendarCheck.getUTCFullYear() !== requested.year ||
    calendarCheck.getUTCMonth() + 1 !== requested.month ||
    calendarCheck.getUTCDate() !== requested.day ||
    calendarCheck.getUTCHours() !== requested.hour ||
    calendarCheck.getUTCMinutes() !== requested.minute
  ) {
    return null;
  }

  let instantMs = wallTimeMs;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = pilotParts(new Date(instantMs));
    const representedWallTimeMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instantMs = wallTimeMs - (representedWallTimeMs - instantMs);
  }

  const result = new Date(instantMs);
  return sameParts(pilotParts(result), requested) ? result : null;
}

export function getPilotBusinessDateParts(value: Date) {
  const { year, month, day } = pilotParts(value);
  return { year, month, day };
}

export function comparePilotBusinessDate(left: Date, right: Date): -1 | 0 | 1 {
  const leftParts = getPilotBusinessDateParts(left);
  const rightParts = getPilotBusinessDateParts(right);
  const leftKey = leftParts.year * 10_000 + leftParts.month * 100 + leftParts.day;
  const rightKey = rightParts.year * 10_000 + rightParts.month * 100 + rightParts.day;

  return leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1;
}

export function addPilotBusinessDays(value: Date, days: number) {
  if (!Number.isInteger(days) || days < 0) {
    throw new RangeError('Количество рабочих дней должно быть целым неотрицательным числом.');
  }

  const source = pilotParts(value);
  const calendar = new Date(Date.UTC(source.year, source.month - 1, source.day, 12));
  let added = 0;

  while (added < days) {
    calendar.setUTCDate(calendar.getUTCDate() + 1);
    const weekday = calendar.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added += 1;
  }

  const localValue = [
    `${calendar.getUTCFullYear()}-${String(calendar.getUTCMonth() + 1).padStart(2, '0')}-${String(calendar.getUTCDate()).padStart(2, '0')}`,
    `${String(source.hour).padStart(2, '0')}:${String(source.minute).padStart(2, '0')}`,
  ].join('T');
  const result = parsePilotDateTimeLocal(localValue);
  if (!result) throw new RangeError('Не удалось рассчитать дату в часовом поясе компании.');

  return new Date(result.getTime() + source.second * 1_000 + value.getUTCMilliseconds());
}
