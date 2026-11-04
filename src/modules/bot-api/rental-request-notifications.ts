import { formatTelegramMessage, telegramSection } from './telegram-message';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

export function formatRentalRequestMessage(input: {
  clientName: string;
  clientPhone: string | null;
  vehicle: string | null;
  registrationNumber: string | null;
  startsAt: Date;
  endsAt: Date;
  fulfillment: string;
}) {
  return formatTelegramMessage({
    title: '📥 <b>Новая заявка на аренду</b>',
    sections: [
      telegramSection('👤', 'Клиент', [
        escapeHtml(input.clientName),
        input.clientPhone ? `📞 <code>${escapeHtml(input.clientPhone)}</code>` : null,
      ]),
      telegramSection('🚗', 'Запрос', [
        input.vehicle
          ? `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`
          : 'Подходящий автомобиль',
        `С ${escapeHtml(dateTime(input.startsAt))} МСК`,
        `До ${escapeHtml(dateTime(input.endsAt))} МСК`,
        `Получение: ${escapeHtml(input.fulfillment)}`,
      ]),
    ],
    action: 'Связаться с клиентом и подтвердить наличие автомобиля',
  });
}
