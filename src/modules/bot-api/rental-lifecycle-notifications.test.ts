import { describe, expect, it } from 'vitest';

import {
  formatClientReturnReminderMessage,
  formatRentalExtensionMessage,
  formatRentalLifecycleMessage,
  formatTomorrowReturnMessage,
} from './rental-lifecycle-notifications';

describe('rental lifecycle notification templates', () => {
  it('formats the staff tomorrow-return reminder in the approved Supa Pro layout', () => {
    const message = formatTomorrowReturnMessage({
      vehicle: 'Volkswagen Polo',
      registrationNumber: 'А156АХ997',
      clientName: 'НОРСТРОЙ',
      clientPhone: null,
      contractNumber: 'ME-2026-0091-NS',
      endsAt: new Date('2026-10-23T08:00:00Z'),
    });

    expect(message).toContain('⏰ <b>Завтра возврат автомобиля</b>');
    expect(message).toContain('Volkswagen Polo · <code>А156АХ997</code>');
    expect(message).toContain('📄 Договор: <code>ME-2026-0091-NS</code>');
    expect(message).toContain('📱 телефон не указан');
    expect(message).toContain('23.10.2026, 11:00 МСК');
  });
});

it('formats a client return reminder in the same block layout', () => {
  const message = formatClientReturnReminderMessage({
    stage: '3h',
    manual: false,
    vehicle: 'Kia K5',
    registrationNumber: 'М022АН997',
    contractNumber: 'SP-3251',
    endsAt: new Date('2026-10-24T12:00:00Z'),
  });

  expect(message).toContain('⏰ <b>До возврата осталось 3 часа</b>');
  expect(message).toContain('🚗 <b>Авто</b>\n└ Kia K5 · <code>М022АН997</code>');
  expect(message).toContain('🗓 <b>Возврат</b>\n└ 24.10.2026, 15:00 МСК');
  expect(message).toContain('⚡ <b>Действие</b>');
  expect(message).not.toContain('Запрос на продление не меняет');
});

it('formats handover and return operations with tree rows in every section', () => {
  const handover = formatRentalLifecycleMessage({
    kind: 'HANDOVER',
    occurredAt: new Date('2026-10-24T12:00:00Z'),
    contractNumber: 'SP-3251',
    vehicle: 'Kia K5',
    registrationNumber: 'М022АН997',
    clientName: 'Иванов Иван',
    actorName: 'Павел Седов',
    mileageKm: 84520,
    fuelLevelPercent: 75,
  });
  const returned = formatRentalLifecycleMessage({
    kind: 'RETURN',
    occurredAt: new Date('2026-10-30T12:18:00Z'),
    contractNumber: 'SP-3251',
    vehicle: 'Kia K5',
    registrationNumber: 'М022АН997',
    clientName: 'Иванов Иван',
    actorName: 'Павел Седов',
    mileageKm: 85140,
    fuelLevelPercent: 42,
    handoverMileageKm: 84520,
    handoverFuelLevelPercent: 75,
  });

  expect(handover).toContain('📊 <b>Выдача</b>\n├ Пробег: <b>84 520 км</b>');
  expect(handover).toContain('└ Оформил: <b>Павел Седов</b>');
  expect(returned).toContain('📊 <b>Возврат</b>\n├ Пробег: <b>85 140 км</b>');
  expect(returned).toContain('├ За аренду: <b>620 км</b>');
  expect(returned).toContain('└ Принял: <b>Павел Седов</b>');
});

it('formats an extension with the shared sections', () => {
  const message = formatRentalExtensionMessage({
    vehicle: 'Kia K5',
    registrationNumber: 'М022АН997',
    clientName: 'Иванов Иван',
    contractNumber: 'SP-3251',
    actorName: 'Павел Седов',
    occurredAt: new Date('2026-10-24T12:00:00Z'),
    previousEndsAt: new Date('2026-10-27T12:00:00Z'),
    nextEndsAt: new Date('2026-10-30T12:00:00Z'),
    extensionChargeMinor: 1080000n,
  });

  expect(message).toContain('🗓 <b>Новый срок</b>\n├ Было до: <b>27.10.2026, 15:00</b>');
  expect(message).toContain('└ Продлено до: <b>30.10.2026, 15:00</b>');
  expect(message).toContain('💰 <b>Доплата</b>\n└ 10 800,00 ₽');
  expect(message).toContain('🕒 <b>Операция</b>');
});
