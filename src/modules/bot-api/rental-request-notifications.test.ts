import { expect, it } from 'vitest';

import { formatRentalRequestMessage } from './rental-request-notifications';

it('formats a rental request with client, vehicle, period and action', () => {
  const message = formatRentalRequestMessage({
    clientName: 'Иванов Иван Иванович',
    clientPhone: '+7 900 000-00-00',
    vehicle: 'Toyota Camry',
    registrationNumber: 'У899АВ997',
    startsAt: new Date('2026-10-26T11:00:00Z'),
    endsAt: new Date('2026-10-30T11:00:00Z'),
    fulfillment: 'Подача по адресу',
  });

  expect(message).toContain('📥 <b>Новая заявка на аренду</b>');
  expect(message).toContain('👤 <b>Клиент</b>\n├ Иванов Иван Иванович');
  expect(message).toContain('🚗 <b>Запрос</b>\n├ Toyota Camry · <code>У899АВ997</code>');
  expect(message).toContain('├ С 26.10.2026, 14:00 МСК');
  expect(message).toContain('└ Получение: Подача по адресу');
  expect(message).toContain('⚡ <b>Действие</b>');
});
