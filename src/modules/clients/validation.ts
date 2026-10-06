import { z } from 'zod';

import { normalizeRussianPhone } from '@/shared/utils/phone';

import type { ClientInput, ClientInputResult, ClientStatus } from './types';
import { composePassportDetails } from './passport-details';

const CLIENT_STATUSES = [
  'DRAFT',
  'NEW',
  'VERIFYING',
  'VERIFIED',
  'REGULAR',
  'BLOCKED',
] as const satisfies readonly ClientStatus[];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_PASSPORT_LENGTH = 1000;
const MAX_LICENSE_LENGTH = 64;

const clientFormSchema = z.object({
  companyId: z.string().trim().min(1, 'Компания обязательна.'),
  firstName: z.string().trim().min(1, 'Укажите имя.').max(100, 'Имя слишком длинное.'),
  middleName: z.string().trim().max(100, 'Отчество слишком длинное.'),
  lastName: z.string().trim().min(1, 'Укажите фамилию.').max(100, 'Фамилия слишком длинная.'),
  birthDate: z.string().trim(),
  phone: z.string().trim(),
  additionalPhone: z.string().trim(),
  email: z.string().trim().max(254, 'Email слишком длинный.'),
  passport: z.string().trim().max(MAX_PASSPORT_LENGTH, 'Паспортные данные слишком длинные.'),
  passportSeries: z.string().trim().max(8, 'Серия паспорта слишком длинная.'),
  passportNumber: z.string().trim().max(16, 'Номер паспорта слишком длинный.'),
  passportIssuedBy: z.string().trim().max(500, 'Название органа выдачи слишком длинное.'),
  passportIssuedAt: z.string().trim(),
  passportDivisionCode: z.string().trim().max(16, 'Код подразделения слишком длинный.'),
  registrationAddress: z.string().trim().max(500, 'Адрес регистрации слишком длинный.'),
  actualAddress: z.string().trim().max(500, 'Фактический адрес слишком длинный.'),
  driverLicense: z
    .string()
    .trim()
    .max(MAX_LICENSE_LENGTH, 'Данные водительского удостоверения слишком длинные.'),
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
    additionalPhone: formString(formData, 'additionalPhone'),
    email: formString(formData, 'email'),
    passport: formString(formData, 'passport'),
    passportSeries: formString(formData, 'passportSeries'),
    passportNumber: formString(formData, 'passportNumber'),
    passportIssuedBy: formString(formData, 'passportIssuedBy'),
    passportIssuedAt: formString(formData, 'passportIssuedAt'),
    passportDivisionCode: formString(formData, 'passportDivisionCode'),
    registrationAddress: formString(formData, 'registrationAddress'),
    actualAddress: formString(formData, 'actualAddress'),
    driverLicense: formString(formData, 'driverLicense'),
    driverLicenseIssuedAt: formString(formData, 'driverLicenseIssuedAt'),
    driverLicenseExpiresAt: formString(formData, 'driverLicenseExpiresAt'),
    status: formString(formData, 'status'),
  };
  const parsed = clientFormSchema.safeParse(rawInput);
  const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed);

  const submittedPhone = rawInput.phone.trim() || formString(formData, 'existingPhone').trim();
  const phone = submittedPhone ? normalizeRussianPhone(submittedPhone) : null;
  if (phone && !/^7\d{10}$/.test(phone)) {
    fieldErrors.phone = 'Укажите российский номер телефона в формате +7.';
  }
  const additionalPhone = rawInput.additionalPhone.trim()
    ? normalizeRussianPhone(rawInput.additionalPhone.trim())
    : null;
  if (additionalPhone && !/^7\d{10}$/.test(additionalPhone)) {
    fieldErrors.additionalPhone = 'Укажите российский номер телефона в формате +7.';
  }

  const email = rawInput.email.trim() || null;
  if (email && !z.email().safeParse(email).success) {
    fieldErrors.email = 'Укажите корректный email.';
  }

  const birthDate = parseDate(rawInput.birthDate.trim(), 'birthDate', fieldErrors);
  if (birthDate && birthDate > new Date()) {
    fieldErrors.birthDate = 'Дата рождения не может быть в будущем.';
  }

  parseDate(rawInput.passportIssuedAt.trim(), 'passportIssuedAt', fieldErrors);

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
    additionalPhone,
    email,
    passport: composePassportDetails(parsed.data.passport, {
      passportSeries: parsed.data.passportSeries,
      passportNumber: parsed.data.passportNumber,
      passportIssuedBy: parsed.data.passportIssuedBy,
      passportIssuedAt: parsed.data.passportIssuedAt,
      passportDivisionCode: parsed.data.passportDivisionCode,
    }),
    registrationAddress: parsed.data.registrationAddress || null,
    actualAddress: parsed.data.actualAddress || null,
    driverLicense: parsed.data.driverLicense || null,
    driverLicenseIssuedAt,
    driverLicenseExpiresAt,
    status: parsed.data.status,
  };

  return { ok: true, data };
}
