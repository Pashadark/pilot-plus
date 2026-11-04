import { expect, it } from 'vitest';

import { formatLeadCreatedMessage, formatLeadStatusChangedMessage } from './lead-notifications';

const lead = {
  name: 'Иван',
  lastName: 'Иванов',
  phone: '+7 900 000-00-00',
  source: 'Сайт Supa Pro',
  nextContactAt: new Date('2026-10-24T14:00:00Z'),
  assignedToName: null,
  createdAt: new Date('2026-10-24T12:00:00Z'),
  leadsUrl: 'https://supapro.ru/leads',
};

it('formats a new lead with the shared Supa Pro block layout', () => {
  const message = formatLeadCreatedMessage(lead);

  expect(message).toContain('📥 <b>Новая заявка</b>');
  expect(message).toContain('👤 <b>Клиент</b>\n├ Иван Иванов\n└ 📞 <code>+7 900 000-00-00</code>');
  expect(message).toContain('📍 <b>Источник</b>\n└ Сайт Supa Pro');
  expect(message).toContain('🗓 <b>Следующий контакт</b>\n└ 24.10.2026, 17:00 МСК');
  expect(message).toContain('👨‍💼 <b>Ответственный</b>\n└ Не назначен');
  expect(message).not.toContain('<a href=');
});

it('formats a lead status transition as its own block', () => {
  const message = formatLeadStatusChangedMessage({
    ...lead,
    actorName: 'Павел Седов',
    previousStatus: 'NEW',
    status: 'QUALIFIED',
  });

  expect(message).toContain('📌 <b>Статус</b>\n├ Было: Новая\n└ Стало: Подтверждена');
  expect(message).toContain('👨‍💼 <b>Изменил</b>\n└ Павел Седов');
});
