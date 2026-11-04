import { expect, it } from 'vitest';

import { formatDepositReturnedMessage } from './deposit-notifications';

it('formats a returned deposit with the shared Supa Pro block layout', () => {
  const message = formatDepositReturnedMessage({
    contract: 'SP-3251',
    client: 'Иванов Иван Иванович',
    vehicle: 'Kia K5 · М022АН997',
    collected: '20 000 ₽',
    returned: '12 957,40 ₽',
    withheld: '7 042,60 ₽',
    reason: 'Неоплаченные штрафы',
    at: '24.10.2026, 16:10',
    actor: 'Павел Седов',
    rentalId: 'rental-1',
  });

  expect(message).toContain('✅ <b>Залог возвращён</b>');
  expect(message).toContain('🚗 <b>Авто</b>\n└ Kia K5 · М022АН997');
  expect(message).toContain('👤 <b>Клиент</b>\n└ Иванов Иван Иванович');
  expect(message).toContain('💰 <b>Расчёт</b>');
  expect(message).toContain('├ Получено: <b>20 000 ₽</b>');
  expect(message).toContain('└ Возвращено: <b>12 957,40 ₽</b>');
  expect(message).toContain('📝 <b>Причина удержания</b>\n└ Неоплаченные штрафы');
  expect(message).toContain('🕒 <b>Операция</b>\n├ 24.10.2026, 16:10 МСК\n└ Павел Седов');
  expect(message).not.toContain('https://supapro.ru');
});
