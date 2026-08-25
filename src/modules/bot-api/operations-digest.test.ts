import { describe, expect, it } from 'vitest';

import { formatOperationsDigest, type OperationsDigestInput } from './operations-digest';

function fixture(overrides: Partial<OperationsDigestInput> = {}): OperationsDigestInput {
  return {
    date: '2026-08-27',
    requests: 1,
    activeRentals: 7,
    handovers: [],
    returns: [
      {
        at: new Date('2026-08-27T17:30:00Z'),
        title: 'Принять возврат автомобиля',
        contractNumber: 'ME-2026-0020-KS',
        vehicle: 'Mercedes-Benz E220d 4Matic',
        registrationNumber: 'М283АМ997',
        client: 'Клементьев Семен Юрьевич',
        phone: '+79251479256',
      },
    ],
    deposits: [],
    washes: [],
    maintenance: [],
    offlineVehicles: [],
    freeVehicles: [],
    ...overrides,
  };
}

describe('formatOperationsDigest', () => {
  it('formats a readable return card with Telegram HTML', () => {
    const html = formatOperationsDigest(fixture());

    expect(html).toContain('🌙 <b>Сводка СУПА ПРО</b>');
    expect(html).toContain('<i>План работы на 27 августа</i>');
    expect(html).toContain('🔄 <b>Возвраты автомобилей</b>');
    expect(html).toContain('<code>20:30</code>  <b>Принять возврат автомобиля</b>');
    expect(html).toContain('<code>ME-2026-0020-KS</code>');
    expect(html).toContain('Mercedes-Benz E220d 4Matic · <code>М283АМ997</code>');
    expect(html).toContain('Клементьев Семен Юрьевич\n☎️ +79251479256');
    expect(html).not.toContain('**');
  });

  it('renders operational sections, sorts timed cards and hides empty sections', () => {
    const html = formatOperationsDigest(
      fixture({
        returns: [],
        deposits: [
          {
            at: new Date('2026-08-27T08:00:00Z'),
            title: 'Вернуть депозит',
            contractNumber: 'ME-2',
            vehicle: 'Kia Rio',
            registrationNumber: 'Р604АО997',
            client: 'Иванов Иван',
            phone: null,
            amountMinor: '1500000',
          },
        ],
        washes: [
          {
            at: new Date('2026-08-27T07:00:00Z'),
            title: 'Комплексная мойка',
            vehicle: 'Kia K5',
            registrationNumber: 'В342НР797',
          },
          {
            at: new Date('2026-08-27T06:00:00Z'),
            title: 'Мойка кузова',
            vehicle: 'Kia Rio',
            registrationNumber: 'Р604АО997',
          },
        ],
        maintenance: [
          {
            at: new Date('2026-08-27T06:00:00Z'),
            title: 'Замена масла',
            vehicle: 'Skoda Octavia',
            registrationNumber: 'Е435АН997',
            overdue: true,
          },
        ],
        offlineVehicles: [
          {
            vehicle: 'Toyota Camry',
            registrationNumber: 'Н726АХ550',
            lastSignalAt: new Date('2026-08-26T18:00:00Z'),
          },
        ],
      }),
    );

    expect(html).toContain('💰 <b>Возврат депозитов</b>');
    expect(html).toContain('15 000 ₽');
    expect(html).toContain('🧼 <b>Мойки</b>');
    expect(html).toContain('🔧 <b>Техническое обслуживание</b>');
    expect(html).toContain('⚠️ <b>Просрочено:</b> Замена масла');
    expect(html).toContain('📡 <b>Нет GPS-связи</b>');
    expect(html).toContain('<i>Последний сигнал: 26.08, 21:00</i>');
    expect(html).not.toContain('Возвраты автомобилей');
    expect(html.indexOf('<code>09:00</code>')).toBeLessThan(html.indexOf('<code>10:00</code>'));
  });

  it('escapes every dynamic value before inserting it into HTML', () => {
    const html = formatOperationsDigest(
      fixture({
        returns: [
          {
            at: new Date('2026-08-27T17:30:00Z'),
            title: '<script>alert(1)</script>',
            contractNumber: 'A&B',
            vehicle: '<Kia>',
            registrationNumber: 'A<1',
            client: 'Иванов & сын',
            phone: null,
          },
        ],
      }),
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<code>A&amp;B</code>');
    expect(html).toContain('&lt;Kia&gt;');
    expect(html).toContain('Иванов &amp; сын');
  });
});
