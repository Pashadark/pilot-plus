import type { RentalOperationMediaKind } from '../operations/types';

export const weeklyInspectionRequiredMedia = [
  'DASHBOARD_PHOTO',
  'BODY_PHOTO_FRONT',
  'BODY_PHOTO_REAR',
  'BODY_PHOTO_LEFT',
  'BODY_PHOTO_RIGHT',
  'INSPECTION_VIDEO',
] as const satisfies readonly RentalOperationMediaKind[];

function moscowDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function moscowInstant(year: number, month: number, day: number, hour = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 3));
}

function localDateAtNoon(value: Date) {
  const { year, month, day } = moscowDateParts(value);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function moscowWeekRange(value: Date) {
  const local = localDateAtNoon(value);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  const start = moscowInstant(year, month, day);
  return {
    weekKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    start,
    end: new Date(start.getTime() + 7 * 86_400_000),
  };
}

export function nextFridayMorning(value: Date) {
  const local = localDateAtNoon(value);
  const daysUntilFriday = (5 - local.getUTCDay() + 7) % 7;
  local.setUTCDate(local.getUTCDate() + daysUntilFriday);
  let result = moscowInstant(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    8,
  );
  if (result <= value) {
    result = new Date(result.getTime() + 7 * 86_400_000);
  }
  return result;
}

export function isCompleteWeeklyInspection(kinds: readonly string[]) {
  const present = new Set(kinds);
  return weeklyInspectionRequiredMedia.every((kind) => present.has(kind));
}
