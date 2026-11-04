import { formatTelegramMessage, telegramSection } from './telegram-message';

function html(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatDepositReturnedMessage(input: {
  contract: string;
  client: string;
  vehicle: string;
  collected: string;
  returned: string;
  withheld: string;
  reason?: string | null;
  at: string;
  actor: string;
  rentalId: string;
}) {
  return formatTelegramMessage({
    title: '✅ <b>Залог возвращён</b>',
    sections: [
      telegramSection('🚗', 'Авто', [html(input.vehicle)]),
      telegramSection('👤', 'Клиент', [html(input.client)]),
      telegramSection('📄', 'Договор', [`№ <code>${html(input.contract)}</code>`]),
      telegramSection('💰', 'Расчёт', [
        `Получено: <b>${html(input.collected)}</b>`,
        `Удержано: <b>${html(input.withheld)}</b>`,
        `Возвращено: <b>${html(input.returned)}</b>`,
      ]),
      telegramSection('📝', 'Причина удержания', input.reason ? [html(input.reason)] : []),
      telegramSection('🕒', 'Операция', [`${html(input.at)} МСК`, html(input.actor)]),
    ],
  });
}
