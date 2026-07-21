import type {
  MaintenanceInput,
  MaintenanceInputResult,
  MaintenanceKind,
  OperationActionState,
} from './types';

const MAINTENANCE_KINDS: readonly MaintenanceKind[] = [
  'OIL',
  'FILTERS',
  'BRAKES',
  'TIRES',
  'TIMING',
  'INSPECTION',
  'OTHER',
];
const MAX_TEXT_LENGTH = 500;

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function parseScheduledAt(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const scheduledAt = new Date(value);

  if (
    Number.isNaN(scheduledAt.getTime()) ||
    scheduledAt.getFullYear() !== Number(year) ||
    scheduledAt.getMonth() + 1 !== Number(month) ||
    scheduledAt.getDate() !== Number(day) ||
    scheduledAt.getHours() !== Number(hour) ||
    scheduledAt.getMinutes() !== Number(minute)
  ) {
    return null;
  }

  return scheduledAt;
}

function parseOptionalText(value: string, field: string, fieldErrors: Record<string, string>) {
  if (value.length > MAX_TEXT_LENGTH) {
    fieldErrors[field] = 'Текст не должен превышать 500 символов.';
  }

  return value || null;
}

function parseTargetOdometerKm(value: string, fieldErrors: Record<string, string>): number | null {
  if (!value) return null;

  const odometerKm = Number(value);

  if (!Number.isFinite(odometerKm) || odometerKm < 0) {
    fieldErrors.targetOdometerKm = 'Укажите пробег не меньше 0 км.';
    return null;
  }

  return odometerKm;
}

export function parseCostMinor(value: FormDataEntryValue | null) {
  if (value === null || value === '') return { ok: true as const, value: null };

  const rubles = typeof value === 'string' ? Number(value) : Number.NaN;

  if (!Number.isFinite(rubles) || rubles < 0 || rubles > 10_000_000) {
    return { ok: false as const, error: 'Укажите стоимость от 0 до 10 000 000 ₽.' };
  }

  return { ok: true as const, value: Math.round(rubles * 100) };
}

export function parseMaintenanceInput(formData: FormData): MaintenanceInputResult {
  const vehicleId = stringValue(formData, 'vehicleId');
  const title = stringValue(formData, 'title');
  const kindValue = stringValue(formData, 'kind');
  const scheduledAtValue = stringValue(formData, 'scheduledAt');
  const providerValue = stringValue(formData, 'provider');
  const notesValue = stringValue(formData, 'notes');
  const fieldErrors: NonNullable<OperationActionState['fieldErrors']> = {};

  if (!vehicleId) fieldErrors.vehicleId = 'Выберите автомобиль.';
  if (!title) {
    fieldErrors.title = 'Укажите название работы.';
  } else if (title.length > MAX_TEXT_LENGTH) {
    fieldErrors.title = 'Текст не должен превышать 500 символов.';
  }

  const kind = MAINTENANCE_KINDS.find((candidate) => candidate === kindValue);
  if (!kind) fieldErrors.kind = 'Выберите корректный вид ТО.';

  const scheduledAt = parseScheduledAt(scheduledAtValue);
  if (!scheduledAt) fieldErrors.scheduledAt = 'Укажите корректную плановую дату.';

  const targetOdometerKm = parseTargetOdometerKm(
    stringValue(formData, 'targetOdometerKm'),
    fieldErrors,
  );
  const provider = parseOptionalText(providerValue, 'provider', fieldErrors);
  const notes = parseOptionalText(notesValue, 'notes', fieldErrors);
  const parsedCost = parseCostMinor(formData.get('costRubles'));

  if (!parsedCost.ok) fieldErrors.costRubles = parsedCost.error;

  if (Object.keys(fieldErrors).length > 0 || !kind || !scheduledAt || !parsedCost.ok) {
    return { ok: false, state: { status: 'error', fieldErrors } };
  }

  const data: MaintenanceInput = {
    vehicleId,
    title,
    kind,
    scheduledAt,
    targetOdometerKm,
    provider,
    costMinor: parsedCost.value,
    notes,
  };

  return { ok: true, data };
}
