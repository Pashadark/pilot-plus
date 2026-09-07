import { describe, expect, it } from 'vitest';

import { formatLeadCreatedMessage, formatLeadStatusChangedMessage } from './lead-notifications';

const common = {
  name: 'Анна',
  lastName: null,
  phone: '+7 999 123-45-67',
  source: 'Авито',
  nextContactAt: null,
  assignedToName: 'Павел Седов',
  createdAt: new Date('2026-09-07T08:00:00.000Z'),
  leadsUrl: 'https://supapro.ru/leads',
};

describe('lead Telegram messages', () => {
  it('formats a new lead with an explicit unscheduled state', () => {
    const message = formatLeadCreatedMessage(common);

    expect(message).toContain('📥 <b>Новая заявка</b>');
    expect(message).toContain('<b>Анна</b>');
    expect(message).toContain('Время не назначено');
    expect(message).toContain('<a href="https://supapro.ru/leads">Открыть заявки</a>');
  });

  it('formats the status transition and escapes all untrusted HTML', () => {
    const message = formatLeadStatusChangedMessage({
      ...common,
      name: '<script>alert(1)</script>',
      lastName: 'Иванова & Петрова',
      source: '<Авито>',
      assignedToName: null,
      actorName: 'Оператор <1>',
      previousStatus: 'NEW',
      status: 'CONTACTED',
    });

    expect(message).toContain('Новая → Связались');
    expect(message).not.toContain('<script>');
    expect(message).toContain('&lt;script&gt;');
    expect(message).toContain('Оператор &lt;1&gt;');
  });
});
