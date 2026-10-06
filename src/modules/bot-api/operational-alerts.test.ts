import { describe, expect, it } from 'vitest';

import {
  classifyGpsSilence,
  classifyRentalDeadline,
  formatOperationalAlert,
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

    expect(message).toContain('Водитель: <b>Задорин Николай Константинович</b>');
    expect(message).toContain('Скорость 127 км/ч');
    expect(message).toContain('18.09.2026, 14:32');
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
    expect(message).toContain('Постановление № <code>18810550260831038048</code>');
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
