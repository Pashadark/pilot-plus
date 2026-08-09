import { z } from 'zod';

import { normalizeRussianPhone } from '@/shared/utils/phone';

import type { ClientInput, ClientInputResult, ClientStatus } from './types';

const CLIENT_STATUSES = [
  'DRAFT',
  'NEW',
  'VERIFYING',
  'VERIFIED',
  'REGULAR',
  'BLOCKED',
] as const satisfies readonly ClientStatus[];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_DOCUMENT_LENGTH = 64;

const clientFormSchema = z.object({
  companyId: z.string().trim().min(1, 'Компания обязательна.'),
  firstName: z.string().trim().min(1, 'Укажите имя.').max(100, 'Имя слишком длинное.'),
  middleName: z.string().trim().max(100, 'Отчество слишком длинное.'),
  lastName: z.string().trim().min(1, 'Укажите фамилию.').max(100, 'Фамилия слишком длинная.'),
  birthDate: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim().max(254, 'Email слишком длинный.'),
  passport: z.string().trim().max(MAX_DOCUMENT_LENGTH, 'Паспортные данные слишком длинные.'),
  driverLicense: z
    .string()
    .trim()
    .max(MAX_DOCUMENT_LENGTH, 'Данные водительского удостоверения слишком длинные.'),
  driverLicenseIssuedAt: z.string().trim(),
  driverLicenseExpiresAt: z.string().trim(),
  status: z.enum(CLIENT_STATUSES, 'Выберите корректный статус клиента.'),
});

function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function parseDate(value: string, field: string, fieldErrors: Record<string, string>): Date | null {
  if (!value) return null;

  const match = DATE_PATTERN.exec(value);
  if (!match) {
    fieldErrors[field] = 'Укажите корректную дату.';
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    fieldErrors[field] = 'Укажите корректную дату.';
    return null;
  }

  return date;
}

function zodFieldErrors(result: z.ZodSafeParseError<unknown>): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

export function parseClientInput(formData: FormData): ClientInputResult {
  const rawInput = {
    companyId: formString(formData, 'companyId'),
    firstName: formString(formData, 'firstName'),
    middleName: formString(formData, 'middleName'),
    lastName: formString(formData, 'lastName'),
    birthDate: formString(formData, 'birthDate'),
    phone: formString(formData, 'phone'),
    email: formString(formData, 'email'),
    passport: formString(formData, 'passport'),
    driverLicense: formString(formData, 'driverLicense'),
    driverLicenseIssuedAt: formString(formData, 'driverLicenseIssuedAt'),
    driverLicenseExpiresAt: formString(formData, 'driverLicenseExpiresAt'),
    status: formString(formData, 'status'),
  };
  const parsed = clientFormSchema.safeParse(rawInput);
  const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed);

  const phone = normalizeRussianPhone(rawInput.phone.trim());
  if (!/^7\d{10}$/.test(phone)) {
    fieldErrors.phone = 'Укажите российский номер телефона в формате +7.';
  }

  const email = rawInput.email.trim() || null;
  if (email && !z.email().safeParse(email).success) {
    fieldErrors.email = 'Укажите корректный email.';
  }

  const birthDate = parseDate(rawInput.birthDate.trim(), 'birthDate', fieldErrors);
  if (birthDate && birthDate > new Date()) {
    fieldErrors.birthDate = 'Дата рождения не может быть в будущем.';
  }

  const driverLicenseIssuedAt = parseDate(
    rawInput.driverLicenseIssuedAt.trim(),
    'driverLicenseIssuedAt',
    fieldErrors,
  );
  const driverLicenseExpiresAt = parseDate(
    rawInput.driverLicenseExpiresAt.trim(),
    'driverLicenseExpiresAt',
    fieldErrors,
  );
  if (
    driverLicenseIssuedAt &&
    driverLicenseExpiresAt &&
    driverLicenseExpiresAt <= driverLicenseIssuedAt
  ) {
    fieldErrors.driverLicenseExpiresAt = 'Срок действия прав должен быть позднее даты выдачи.';
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const data: ClientInput = {
    companyId: parsed.data.companyId,
    firstName: parsed.data.firstName,
    middleName: parsed.data.middleName || null,
    lastName: parsed.data.lastName,
    birthDate,
    phone,
    email,
    passport: parsed.data.passport || null,
    driverLicense: parsed.data.driverLicense || null,
    driverLicenseIssuedAt,
    driverLicenseExpiresAt,
    status: parsed.data.status,
  };

  return { ok: true, data };
}
