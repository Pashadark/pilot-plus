import type { LeadStatus } from '@/database/generated/prisma';
import { normalizeRussianPhone } from '@/shared/utils/phone';

import { leadStatuses, type LeadInput } from './types';

function value(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === 'string' ? field.trim() : '';
}

export function parseLeadInput(
  formData: FormData,
): { ok: true; data: LeadInput } | { ok: false; fieldErrors: Record<string, string> } {
  const nextContactRaw = value(formData, 'nextContactAt');
  const nextContactAt = nextContactRaw ? new Date(nextContactRaw) : null;
  const data = {
    companyId: value(formData, 'companyId'),
    name: value(formData, 'name'),
    lastName: value(formData, 'lastName'),
    phone: value(formData, 'phone'),
    source: value(formData, 'source'),
    comment: value(formData, 'comment'),
    nextContactAt,
  };
  const fieldErrors: Record<string, string> = {};
  const phone = normalizeRussianPhone(data.phone);

  if (!data.companyId) fieldErrors.companyId = 'Выберите компанию.';
  if (data.name.length < 2 || data.name.length > 150) fieldErrors.name = 'Укажите имя клиента.';
  if (data.lastName.length > 150) fieldErrors.lastName = 'Не более 150 символов.';
  if (!/^7\d{10}$/u.test(phone)) fieldErrors.phone = 'Укажите российский номер телефона.';
  if (data.source.length > 100) fieldErrors.source = 'Не более 100 символов.';
  if (data.comment.length > 2000) fieldErrors.comment = 'Не более 2000 символов.';
  if (nextContactAt && Number.isNaN(nextContactAt.valueOf())) {
    fieldErrors.nextContactAt = 'Укажите корректные дату и время.';
  }

  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, data };
}

export function parseLeadStatus(value: unknown): LeadStatus | null {
  return typeof value === 'string' && leadStatuses.includes(value as LeadStatus)
    ? (value as LeadStatus)
    : null;
}
