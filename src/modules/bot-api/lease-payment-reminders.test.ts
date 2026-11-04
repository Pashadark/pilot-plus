import { describe, expect, it, vi } from 'vitest';

import {
  enqueueLeasePaymentReminders,
  findDueLeasePayment,
  formatLeasePaymentReminderMessage,
} from './lease-payment-reminders';

function rental(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rental-1',
    companyId: 'company-1',
    snapshot: {
      paymentSchedule: [
        {
          dueAt: '2026-12-03T15:00:00.000Z',
          number: 2,
          status: 'SCHEDULED',
          amountMinor: '8500000',
        },
      ],
    },
    client: { telegramIdentity: { id: 'identity-1', isActive: true } },
    ...overrides,
  };
}

function database(rows = [rental()]) {
  return {
    rental: { findMany: vi.fn().mockResolvedValue(rows) },
    botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
}

describe('напоминания о платеже аренды с выкупом', () => {
  it('ставит отдельные staff и client задания в 09:00 МСК за день до платежа', async () => {
    const db = database();

    await expect(
      enqueueLeasePaymentReminders(new Date('2026-12-02T06:05:00.000Z'), db as never),
    ).resolves.toBe(2);

    expect(db.rental.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agreementType: 'LEASE_TO_OWN', status: 'ACTIVE' },
      }),
    );
    expect(db.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          chatId: 'staff:company-1',
          template: 'LEASE_TO_OWN_PAYMENT_STAFF',
          eventKey: 'lease-payment:company-1:rental-1:2:2026-12-03:staff',
          payload: { rentalId: 'rental-1', paymentNumber: 2, dueDate: '2026-12-03' },
        }),
        expect.objectContaining({
          identityId: 'identity-1',
          template: 'LEASE_TO_OWN_PAYMENT_CLIENT',
          eventKey: 'lease-payment:company-1:rental-1:2:2026-12-03:client',
          payload: { rentalId: 'rental-1', paymentNumber: 2, dueDate: '2026-12-03' },
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it('не запускается вне московского окна 09:00–09:14', async () => {
    const db = database();

    await expect(
      enqueueLeasePaymentReminders(new Date('2026-12-02T06:15:00.000Z'), db as never),
    ).resolves.toBe(0);

    expect(db.rental.findMany).not.toHaveBeenCalled();
    expect(db.botNotificationJob.createMany).not.toHaveBeenCalled();
  });

  it('не напоминает об оплаченном платеже и не требует Telegram клиента для staff задания', async () => {
    const paid = rental({
      snapshot: {
        paymentSchedule: [
          {
            dueAt: '2026-12-03T15:00:00.000Z',
            number: 2,
            status: 'PAID',
            amountMinor: '8500000',
          },
        ],
      },
    });
    const withoutIdentity = rental({
      id: 'rental-2',
      client: { telegramIdentity: null },
    });
    const db = database([paid, withoutIdentity]);
    db.botNotificationJob.createMany.mockResolvedValue({ count: 1 });

    await expect(
      enqueueLeasePaymentReminders(new Date('2026-12-02T06:00:00.000Z'), db as never),
    ).resolves.toBe(1);

    const rows = db.botNotificationJob.createMany.mock.calls[0]?.[0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        eventKey: 'lease-payment:company-1:rental-2:2:2026-12-03:staff',
      }),
    );
  });

  it('валидирует точную строку графика по московской дате', () => {
    expect(
      findDueLeasePayment(
        {
          paymentSchedule: [
            {
              dueAt: '2026-12-03T15:00:00.000Z',
              number: 2,
              status: 'SCHEDULED',
              amountMinor: '8500000',
            },
          ],
        },
        '2026-12-03',
      ),
    ).toEqual({
      dueAt: '2026-12-03T15:00:00.000Z',
      number: 2,
      status: 'SCHEDULED',
      amountMinor: '8500000',
    });
    expect(findDueLeasePayment({ paymentSchedule: 'invalid' }, '2026-12-03')).toBeNull();
  });

  it('форматирует утверждённые блоки сообщения Supa Pro', () => {
    const message = formatLeasePaymentReminderMessage({
      vehicle: 'BMW 3',
      registrationNumber: 'Н533УС797',
      clientName: 'Иванов Иван Иванович',
      contractNumber: 'ME-2026-1103-BT',
      phone: '+7 900 111-22-33',
      paymentNumber: 2,
      dueAt: new Date('2026-12-03T15:00:00.000Z'),
      amountMinor: '8500000',
      action: 'Связаться с клиентом и подтвердить оплату',
    });

    expect(message).toContain('⏰ <b>Завтра платёж по аренде с выкупом</b>');
    expect(message).toContain('🚗 <b>Авто</b>');
    expect(message).toContain('💰 <b>Платёж</b>');
    expect(message).toContain('№2 · <b>85 000 ₽</b>');
    expect(message).toContain('⚡ <b>Действие</b>');
  });
});
