import { describe, expect, it } from 'vitest';

import {
  formatOperationsDigest,
  formatOperationsDigestParts,
  type OperationsDigestInput,
} from './operations-digest';

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
  it('splits the daily digest into three bounded, explicit sections', () => {
    const parts = formatOperationsDigestParts(
      fixture({
        returns: [],
        criticalProblems: [],
        trackerProblems: [],
        offlineVehicles: [],
        freeVehicles: [],
        yesterday: {
          revenueMinor: '22049000',
          completedRentals: 2,
          incidents: 4,
          loadPercent: 88,
        },
        fleet: { rented: 22, free: 3, booked: 0, maintenance: 0, unknown: 0, total: 25 },
      }),
    );

    expect(parts.map((part) => part.key)).toEqual(['critical', 'trackers', 'totals']);
    expect(parts[0].message).toContain('🌙 <b>Сводка СУПА ПРО</b>');
    expect(parts[0].message).toContain('✅ <b>Критических проблем нет</b>');
    expect(parts[1].message).toContain('✅ <b>Проблем с трекерами нет</b>');
    expect(parts[1].message).toContain('✅ <b>Все автомобили на связи</b>');
    expect(parts[2].message).toContain('✅ <b>Возвратов на сегодня нет</b>');
    expect(parts[2].message).toContain('🚫 <b>Свободных автомобилей нет</b>');
    expect(parts.every((part) => part.message.length <= 3900)).toBe(true);
  });

  it('limits long digest lists and reports the hidden item count', () => {
    const returns = Array.from({ length: 14 }, (_, index) => ({
      at: new Date(`2026-08-27T${String(index).padStart(2, '0')}:00:00Z`),
      title: 'Принять возврат автомобиля',
      contractNumber: `ME-${index + 1}`,
      vehicle: 'Kia K5',
      registrationNumber: `А${String(index).padStart(3, '0')}АА997`,
      client: `Клиент ${index + 1}`,
      phone: '+79990000000',
    }));
    const problems = Array.from({ length: 23 }, (_, index) => ({
      vehicle: `Автомобиль ${index + 1}`,
      registrationNumber: `В${String(index).padStart(3, '0')}ВВ997`,
      details: 'Нет связи 1 дн. 2 ч.',
      action: 'Позвонить клиенту.',
    }));

    const parts = formatOperationsDigestParts(
      fixture({ returns, criticalProblems: problems, trackerProblems: problems }),
    );

    expect(parts[0].message).toContain('…и ещё 3');
    expect(parts[1].message).toContain('…и ещё 3');
    expect(parts[2].message).toContain('…и ещё 4');
    expect(parts[2].message).not.toContain('ME-11');
    expect(parts.every((part) => part.message.length <= 3900)).toBe(true);
  });

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

  it('renders yesterday, fleet, leads, honest fine status and Monday weekly totals', () => {
    const html = formatOperationsDigest(
      fixture({
        yesterday: {
          revenueMinor: '12500000',
          completedRentals: 4,
          incidents: 1,
          loadPercent: 64,
        },
        fleet: { rented: 7, free: 3, booked: 2, maintenance: 1, unknown: 1, total: 14 },
        finesApiAvailable: false,
        leads: [
          {
            at: new Date('2026-08-27T07:30:00Z'),
            name: 'Петрова Анна',
            source: 'Авито',
            phone: '+7 999 000-00-00',
            overdue: false,
          },
        ],
        recommendations: ['Позвонить по заявке Петровой в 10:30'],
        weekly: {
          startDate: '2026-08-20',
          endDate: '2026-08-26',
          revenueMinor: '70000000',
          rentals: 12,
          averageDurationDays: 3.5,
          loadPercent: 61,
        },
      }),
    );

    expect(html).toContain('📊 <b>Итоги вчера</b>');
    expect(html).toContain('Выручка: <b>125 000 ₽</b>');
    expect(html).toContain('📋 <b>Текущий статус</b>');
    expect(html).toContain('Загрузка парка: <b>50%</b>');
    expect(html).toContain('Штрафы не проверены (API недоступен)');
    expect(html).toContain('📞 <b>Заявки на сегодня</b>');
    expect(html).toContain('<b>Петрова Анна</b> · Авито');
    expect(html).toContain('🤖 <b>Рекомендации</b>');
    expect(html).toContain('📊 <b>Недельный отчёт</b>');
  });
});
