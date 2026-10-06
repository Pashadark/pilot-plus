import { expect, it } from 'vitest';
import { formatDepositReturnedMessage } from './deposit-notifications';

it('formats the deposit like lifecycle notifications and escapes customer data', () => {
  const message = formatDepositReturnedMessage({
    contract: 'ME-62',
    client: 'Имя <test>',
    vehicle: 'Kia Rio',
    collected: '20 000 ₽',
    returned: '18 000 ₽',
    withheld: '2 000 ₽',
    reason: '<мойка>',
    at: '24.09.2026, 14:00',
    actor: 'Павел',
    rentalId: 'rental-1',
  });
  expect(message).toContain('💳 <b>Залог по договору оформлен</b>');
  expect(message).toContain('Возвращено: <b>18 000 ₽</b>');
  expect(message).toContain('Имя &lt;test&gt;');
  expect(message).toContain('Причина: &lt;мойка&gt;');
  expect(message).toContain('https://supapro.ru/rentals/rental-1');
  expect(message).not.toContain('\n\n');
});
