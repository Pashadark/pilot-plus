const MOSCOW_TIME_ZONE = 'Europe/Moscow';

export type UnpaidFineReportItem = {
  decreeNumber: string;
  clientLastName: string | null;
  vehicle: string;
  registrationNumber: string | null;
  violation: string;
  originalAmountMinor: string;
  currentAmountMinor: string;
  offenseAt: Date;
  discountExpiresAt: Date | null;
  status: 'NEW' | 'UNPAID' | 'OVERDUE';
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(minor: string): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(BigInt(minor)) / 100);
}

function date(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

function reportDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 9)));
}

const statusTitles: Record<UnpaidFineReportItem['status'], string> = {
  NEW: 'Новый',
  UNPAID: 'Не оплачен',
  OVERDUE: 'Просрочен',
};

export function formatUnpaidFinesReport(reportDay: string, items: UnpaidFineReportItem[]): string {
  if (!items.length) {
    return formatTelegramMessage({
      title: '✅ <b>Неоплаченных штрафов нет</b>',
      sections: [telegramSection('📊', 'Сводка', [`Дата: ${escapeHtml(reportDate(reportDay))}`])],
    });
  }

  return formatTelegramMessage({
    title: '🚨 <b>Неоплаченные штрафы</b>',
    sections: [
      telegramSection('📊', 'Сводка', [
        `Дата: ${escapeHtml(reportDate(reportDay))}`,
        `Всего: <b>${items.length}</b>`,
      ]),
      ...items.map((item, index) => {
        const client = item.clientLastName?.trim() || 'Клиент не назначен';
        const registrationNumber = item.registrationNumber?.trim() || 'без номера';
        const amountLines =
          item.originalAmountMinor === item.currentAmountMinor
            ? [`Сумма: <b>${escapeHtml(money(item.currentAmountMinor))}</b>`]
            : [
                `Полная сумма: <b>${escapeHtml(money(item.originalAmountMinor))}</b>`,
                `К оплате: <b>${escapeHtml(money(item.currentAmountMinor))}</b>`,
              ];
        return telegramSection('🚨', `Штраф ${index + 1}`, [
          `Клиент: <b>${escapeHtml(client)}</b>`,
          `${escapeHtml(item.vehicle)} · <code>${escapeHtml(registrationNumber)}</code>`,
          `Постановление № <code>${escapeHtml(item.decreeNumber)}</code>`,
          `Нарушение: ${escapeHtml(item.violation)}`,
          ...amountLines,
          `Дата нарушения: <b>${escapeHtml(date(item.offenseAt))}</b>`,
          item.discountExpiresAt
            ? `Скидка до: <b>${escapeHtml(date(item.discountExpiresAt))}</b>`
            : 'Срок скидки: <b>не указан</b>',
          `Статус: <b>${escapeHtml(statusTitles[item.status])}</b>`,
        ]);
      }),
    ],
    action: 'Сначала оплатить срочные штрафы и распределить не назначенные',
  });
}
import { formatTelegramMessage, telegramSection } from './telegram-message';
