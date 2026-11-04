import type { LeadStatus } from '@/database/generated/prisma';
import { formatTelegramMessage, telegramSection } from './telegram-message';

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

export function formatLeadCreatedMessage(input: LeadMessageBase) {
  return formatTelegramMessage({
    title: '📥 <b>Новая заявка</b>',
    sections: [
      telegramSection('👤', 'Клиент', [
        escapeHtml(fullName(input)),
        `📞 <code>${escapeHtml(input.phone?.trim() || 'Телефон не указан')}</code>`,
      ]),
      telegramSection('📍', 'Источник', [escapeHtml(input.source ?? 'Не указан')]),
      telegramSection('🗓', 'Следующий контакт', [
        `${input.nextContactAt ? escapeHtml(displayDate(input.nextContactAt)) : 'Время не назначено'} МСК`,
      ]),
      telegramSection('👨‍💼', 'Ответственный', [escapeHtml(input.assignedToName ?? 'Не назначен')]),
      telegramSection('🕒', 'Создана', [`${escapeHtml(displayDate(input.createdAt))} МСК`]),
    ],
    action: 'Обработать заявку и связаться с клиентом',
  });
}

export function formatLeadStatusChangedMessage(input: LeadStatusMessage) {
  return formatTelegramMessage({
    title: '🔄 <b>Статус заявки изменён</b>',
    sections: [
      telegramSection('👤', 'Клиент', [
        escapeHtml(fullName(input)),
        `📞 <code>${escapeHtml(input.phone?.trim() || 'Телефон не указан')}</code>`,
      ]),
      telegramSection('📌', 'Статус', [
        `Было: ${LEAD_STATUS_LABELS[input.previousStatus]}`,
        `Стало: ${LEAD_STATUS_LABELS[input.status]}`,
      ]),
      telegramSection('👨‍💼', 'Изменил', [escapeHtml(input.actorName ?? 'Сотрудник')]),
      telegramSection('🗓', 'Следующий контакт', [
        `${input.nextContactAt ? escapeHtml(displayDate(input.nextContactAt)) : 'Время не назначено'} МСК`,
      ]),
    ],
  });
}
