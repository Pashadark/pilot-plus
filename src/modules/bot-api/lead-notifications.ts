import type { LeadStatus } from '@/database/generated/prisma';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Новая',
  CONTACTED: 'Связались',
  QUALIFIED: 'Подтверждена',
  BOOKED: 'Перешла в аренду',
  LOST: 'Неактуальна',
};

type LeadMessageBase = {
  name: string;
  lastName: string | null;
  phone: string | null;
  source: string | null;
  nextContactAt: Date | null;
  assignedToName: string | null;
  createdAt: Date;
  leadsUrl: string;
};

type LeadStatusMessage = LeadMessageBase & {
  actorName: string | null;
  previousStatus: LeadStatus;
  status: LeadStatus;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function displayDate(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

function fullName(input: LeadMessageBase) {
  return [input.name, input.lastName].filter(Boolean).join(' ');
}

function leadDetails(input: LeadMessageBase) {
  return [
    `👤 <b>${escapeHtml(fullName(input))}</b>`,
    `📞 <code>${escapeHtml(input.phone?.trim() || 'Телефон не указан')}</code>`,
    `📍 Источник: <b>${escapeHtml(input.source ?? 'Не указан')}</b>`,
    `🕒 Следующий контакт: <b>${input.nextContactAt ? escapeHtml(displayDate(input.nextContactAt)) : 'Время не назначено'}</b>`,
  ];
}

export function formatLeadCreatedMessage(input: LeadMessageBase) {
  return [
    '📥 <b>Новая заявка</b>',
    ...leadDetails(input),
    `👨‍💼 Ответственный: <b>${escapeHtml(input.assignedToName ?? 'Не назначен')}</b>`,
    `🗓 Создана: <b>${escapeHtml(displayDate(input.createdAt))}</b>`,
    `🔗 <a href="${escapeHtml(input.leadsUrl)}">Открыть заявки</a>`,
  ].join('\n');
}

export function formatLeadStatusChangedMessage(input: LeadStatusMessage) {
  return [
    '🔄 <b>Статус заявки изменён</b>',
    ...leadDetails(input),
    `📌 <b>${LEAD_STATUS_LABELS[input.previousStatus]} → ${LEAD_STATUS_LABELS[input.status]}</b>`,
    `👨‍💼 Изменил: <b>${escapeHtml(input.actorName ?? 'Сотрудник')}</b>`,
    `🔗 <a href="${escapeHtml(input.leadsUrl)}">Открыть заявки</a>`,
  ].join('\n');
}
