import { describe, expect, it } from 'vitest';

import { formatTelegramMessage, telegramSection } from './telegram-message';

describe('Telegram message design system', () => {
  it('formats every message as a title followed by spaced tree sections and an action', () => {
    const message = formatTelegramMessage({
      title: '🚨 <b>Новый штраф</b>',
      sections: [
        telegramSection('🚗', 'Авто', ['Kia K5 · <code>М022АН997</code>']),
        telegramSection('👤', 'Клиент', ['Иванов Иван Иванович']),
        telegramSection('📄', 'Постановление', ['№ <code>123</code>', 'Сумма: <b>5 000 ₽</b>']),
      ],
      action: 'Проверить водителя и отправить штраф клиенту',
    });

    expect(message).toBe(
      [
        '🚨 <b>Новый штраф</b>',
        '',
        '🚗 <b>Авто</b>',
        '└ Kia K5 · <code>М022АН997</code>',
        '',
        '👤 <b>Клиент</b>',
        '└ Иванов Иван Иванович',
        '',
        '📄 <b>Постановление</b>',
        '├ № <code>123</code>',
        '└ Сумма: <b>5 000 ₽</b>',
        '',
        '⚡ <b>Действие</b>',
        '└ Проверить водителя и отправить штраф клиенту',
      ].join('\n'),
    );
  });

  it('omits empty sections without leaving duplicate blank lines', () => {
    const message = formatTelegramMessage({
      title: '✅ <b>Готово</b>',
      sections: [telegramSection('👤', 'Клиент', []), null],
    });

    expect(message).toBe('✅ <b>Готово</b>');
  });
});
