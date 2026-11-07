import { describe, expect, it } from 'vitest';

import {
  classifyGpsSilence,
  classifyRentalDeadline,
  formatClientGpsEvent,
  formatOperationalAlert,
  formatOperationalAlertForAudience,
} from './operational-alerts';

describe('operational alert thresholds', () => {
  it('does not alarm for short GPS silence and escalates rented vehicles', () => {
    expect(classifyGpsSilence({ isRented: true, silentForMs: 5 * 60 * 60_000 })).toBeNull();
    expect(classifyGpsSilence({ isRented: true, silentForMs: 6 * 60 * 60_000 })).toBe(
      'RENTED_GPS_WARNING',
    );
    expect(classifyGpsSilence({ isRented: true, silentForMs: 24 * 60 * 60_000 })).toBe(
      'RENTED_GPS_CRITICAL',
    );
    expect(classifyGpsSilence({ isRented: true, silentForMs: 48 * 60 * 60_000 })).toBe(
      'RENTED_GPS_THEFT_RISK',
    );
  });

  it('only warns for a free vehicle after 48 hours without GPS', () => {
    expect(classifyGpsSilence({ isRented: false, silentForMs: 47 * 60 * 60_000 })).toBeNull();
    expect(classifyGpsSilence({ isRented: false, silentForMs: 48 * 60 * 60_000 })).toBe(
      'FREE_GPS_TRACKER_PROBLEM',
    );
  });

  it('alerts two hours before a return and escalates two hours after it', () => {
    expect(classifyRentalDeadline(-3 * 60 * 60_000)).toBeNull();
    expect(classifyRentalDeadline(-2 * 60 * 60_000)).toBe('RETURN_SOON');
    expect(classifyRentalDeadline(30 * 60_000)).toBeNull();
    expect(classifyRentalDeadline(2 * 60 * 60_000)).toBe('RETURN_OVERDUE');
  });

  it('formats a concrete safe action for a critical rented vehicle', () => {
    const message = formatOperationalAlert({
      kind: 'RENTED_GPS_THEFT_RISK',
      vehicle: 'Mercedes <E220>',
      registrationNumber: 'М283АМ997',
      silentForMs: 49 * 60 * 60_000,
      clientName: 'Петров & сын',
      clientPhone: '+7 900 000-00-00',
    });

    expect(message).toContain('🔴 <b>Срочно: машина без связи более 48 часов</b>');
    expect(message).toContain('Mercedes &lt;E220&gt;');
    expect(message).toContain('Петров &amp; сын');
    expect(message).toContain('Срочно позвонить клиенту');
    expect(message).not.toContain('<E220>');
  });

  it('formats a low-fuel alert with the current percentage and action', () => {
    const message = formatOperationalAlert({
      kind: 'LOW_FUEL',
      vehicle: 'Kia Cerato',
      registrationNumber: 'С886АУ997',
      fuelLevelPercent: 15,
    });

    expect(message).toContain('⛽ <b>Низкий уровень топлива</b>');
    expect(message).toContain('Осталось: <b>15%</b>');
    expect(message).toContain('заправить автомобиль');
  });

  it('includes the driver and Moscow time in a speeding alert', () => {
    const message = formatOperationalAlert({
      kind: 'SPEEDING',
      vehicle: 'Kia Cerato',
      registrationNumber: 'У621АВ997',
      clientName: 'Задорин Николай Константинович',
      eventTitle: 'Скорость 127 км/ч',
      eventRecordedAt: new Date('2026-09-18T11:32:00.000Z'),
    });

    expect(message).toContain('👤 <b>Клиент</b>');
    expect(message).toContain('└ Задорин Николай Константинович');
    expect(message).toContain('📍 <b>Событие</b>');
    expect(message).toContain('Скорость 127 км/ч');
    expect(message).toContain('18.09.2026, 14:32');
    expect(message).toContain('⚡ <b>Действие</b>');
  });

  it('formats a harsh-acceleration event in the same Supa Pro block style', () => {
    const message = formatOperationalAlert({
      kind: 'HARSH_ACCELERATION',
      vehicle: 'Kia K5',
      registrationNumber: 'М022АН997',
      clientName: 'Иванов Иван Иванович',
      eventTitle: 'Резкий разгон · 3,6 м/с²',
      eventDescription: 'Скорость выросла с 12 до 52 км/ч за 3 секунды.',
      eventRecordedAt: new Date('2026-10-25T12:00:00.000Z'),
    });

    expect(message).toContain('🟠 <b>Резкий разгон</b>');
    expect(message).toContain('🚗 <b>Авто</b>');
    expect(message).toContain('👤 <b>Клиент</b>');
    expect(message).toContain('Резкий разгон · 3,6 м/с²');
    expect(message).toContain('25.10.2026, 15:00 МСК');
    expect(message).toContain('Проверить маршрут и связаться с водителем');
  });

  it('formats harsh braking in the same Supa Pro block style for staff and client', () => {
    const input = {
      kind: 'HARSH_BRAKING' as const,
      vehicle: 'Kia Ceed',
      registrationNumber: 'А429АУ997',
      eventTitle: 'Резкое торможение',
      eventDescription: 'Скорость снизилась с 92 до 48 км/ч за 3 сек.',
      eventRecordedAt: new Date('2026-10-27T12:00:00.000Z'),
    };

    const staffMessage = formatOperationalAlert({
      ...input,
      clientName: 'Щапова Екатерина Николаевна',
    });
    const clientMessage = formatClientGpsEvent(input);

    expect(staffMessage).toContain('🔵 <b>Резкое торможение</b>');
    expect(staffMessage).toContain('Щапова Екатерина Николаевна');
    expect(staffMessage).toContain('92 до 48 км/ч');
    expect(staffMessage).toContain('Проверить маршрут и связаться с водителем');
    expect(clientMessage).toContain('🔵 <b>Резкое торможение</b>');
    expect(clientMessage).toContain('GPS-событие, а не постановление о штрафе');
  });

  it('formats a client speeding notice as a GPS event rather than an official fine', () => {
    const message = formatClientGpsEvent({
      kind: 'SPEEDING',
      vehicle: 'Kia K5',
      registrationNumber: 'М022АН997',
      eventTitle: 'Скорость 149 км/ч',
      eventDescription: 'Зафиксирована скорость 145 км/ч или выше.',
      eventRecordedAt: new Date('2026-10-25T12:00:00.000Z'),
    });

    expect(message).toContain('⚡ <b>Превышение скорости</b>');
    expect(message).toContain('Kia K5');
    expect(message).toContain('Скорость 149 км/ч');
    expect(message).toContain('25.10.2026, 15:00 МСК');
    expect(message).toContain('GPS-событие, а не постановление о штрафе');
  });

  it.each([
    ['CLIENT', 'Снизьте скорость и продолжайте движение безопасно'],
    ['MANAGER', 'Связаться с водителем и потребовать снизить скорость'],
    ['SUPER_ADMIN', 'Проверить обработку события ответственным менеджером'],
  ] as const)('formats speeding for %s in the shared block layout', (audience, action) => {
    const message = formatOperationalAlertForAudience(
      {
        kind: 'SPEEDING',
        vehicle: 'Toyota Camry',
        registrationNumber: 'У899АВ997',
        clientName: 'Гончаров Михаил Дмитриевич',
        eventTitle: 'Скорость 153 км/ч',
        eventDescription: 'Зафиксирована скорость 145 км/ч или выше.',
        eventRecordedAt: new Date('2026-10-26T10:38:00.000Z'),
      },
      audience,
    );

    expect(message).toContain('⚡ <b>Превышение скорости</b>');
    expect(message).toContain('🚗 <b>Авто</b>');
    expect(message).toContain('👤 <b>Клиент</b>');
    expect(message).toContain('📍 <b>Событие</b>');
    expect(message).toContain(`⚡ <b>Действие</b>\n└ ${action}`);
  });

  it('formats an impound-lot alert in the approved block style', () => {
    const message = formatOperationalAlert({
      kind: 'IMPOUND_LOT_ENTRY',
      vehicle: 'Toyota Camry',
      registrationNumber: 'У899АВ997',
      clientName: 'Гончаров Михаил Дмитриевич',
      eventRecordedAt: new Date('2026-10-23T13:00:00Z'),
      impoundCity: 'Москва',
      impoundAddress: 'улица Подольских Курсантов, вл. 7а',
    });

    expect(message).toContain('🚨 <b>Автомобиль на территории штрафстоянки</b>');
    expect(message).toContain('🚗 <b>Авто</b>\n└ Toyota Camry');
    expect(message).toContain('👤 <b>Клиент</b>\n└ Гончаров Михаил Дмитриевич');
    expect(message).toContain('📍 <b>Штрафстоянка</b>');
    expect(message).toContain('├ Москва');
    expect(message).toContain('├ улица Подольских Курсантов, вл. 7а');
    expect(message).toContain('└ 23.10.2026, 16:00 МСК');
    expect(message).toContain('Срочно связаться с клиентом и проверить эвакуацию');
  });

  it('formats a staff service-arrival alert after the confirmed dwell', () => {
    const message = formatOperationalAlert({
      kind: 'SERVICE_CENTER_ARRIVAL',
      vehicle: 'Toyota Camry',
      registrationNumber: 'Н541АК997',
      clientName: 'Иванов Иван Иванович',
      eventRecordedAt: new Date('2026-11-07T09:40:00Z'),
      serviceAddress: 'Каширское шоссе, 61 к3А',
    });

    expect(message).toContain('🔧 <b>Автомобиль в сервисе</b>');
    expect(message).toContain('🚗 <b>Авто</b>\n└ Toyota Camry');
    expect(message).toContain('👤 <b>Клиент</b>\n└ Иванов Иван Иванович');
    expect(message).toContain('📍 <b>Сервис</b>');
    expect(message).toContain('├ Каширское шоссе, 61 к3А');
    expect(message).toContain('└ 07.11.2026, 12:40 МСК');
    expect(message).toContain('Машина находится в зоне сервиса не менее 40 минут');
  });
  it('includes the full fine description, article and Moscow offense time', () => {
    const message = formatOperationalAlert({
      kind: 'NEW_FINE',
      vehicle: 'Kia Rio',
      registrationNumber: 'Р604АО997',
      fineDecreeNumber: '18810550260831038048',
      fineArticle: '8.14 ч.2',
      fineAmountMinor: '500000',
      fineDescription: 'Неуплата за размещение транспортного средства <на парковке>',
      fineOffenseAt: new Date('2026-09-28T10:29:00Z'),
    });
    expect(message).toContain('28.09.2026, 13:29');
    expect(message).toContain('Неуплата за размещение транспортного средства &lt;на парковке&gt;');
    expect(message).toContain('Статья: 8.14 ч.2');
    expect(message).toContain('📄 <b>Постановление</b>');
    expect(message).toContain('№ <code>18810550260831038048</code>');
  });
  it('does not invent a missing fine description or date', () => {
    const message = formatOperationalAlert({
      kind: 'NEW_FINE',
      vehicle: 'Kia Rio',
      registrationNumber: null,
    });
    expect(message).toContain('Описание не предоставлено');
    expect(message).toContain('Дата нарушения не предоставлена');
  });
});
