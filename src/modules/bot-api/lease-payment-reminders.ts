import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import { formatTelegramMessage, telegramSection } from './telegram-message';

const MOSCOW_TIME_ZONE = 'Europe/Moscow';

export type LeasePayment = {
  dueAt: string;
  number: number;
  status: 'SCHEDULED';
  amountMinor: string;
};

export type LeasePaymentReminderMessageInput = {
  vehicle: string;
  registrationNumber: string | null;
  clientName: string;
  contractNumber: string | null;
  phone: string | null;
  paymentNumber: number;
  dueAt: Date;
  amountMinor: string;
  action: string;
};

export type LeasePaymentReminderDatabase = Pick<typeof prisma, 'rental' | 'botNotificationJob'>;

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function moscowParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function moscowDateKey(value: Date) {
  const parts = moscowParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nextDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function isReminderWindow(now: Date) {
  const parts = moscowParts(now);
  return Number(parts.hour) === 9 && Number(parts.minute) < 15;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function findDueLeasePayment(snapshot: unknown, dueDate: string): LeasePayment | null {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.paymentSchedule)) return null;

  for (const candidate of snapshot.paymentSchedule) {
    if (!isRecord(candidate)) continue;
    const dueAt = typeof candidate.dueAt === 'string' ? candidate.dueAt : '';
    const parsedDueAt = new Date(dueAt);
    const number = candidate.number;
    const amountMinor = candidate.amountMinor;
    if (
      !Number.isFinite(parsedDueAt.getTime()) ||
      !Number.isInteger(number) ||
      Number(number) < 1 ||
      typeof amountMinor !== 'string' ||
      !/^\d+$/u.test(amountMinor) ||
      candidate.status !== 'SCHEDULED' ||
      moscowDateKey(parsedDueAt) !== dueDate
    ) {
      continue;
    }

    return { dueAt, number: Number(number), status: 'SCHEDULED', amountMinor };
  }

  return null;
}

function money(amountMinor: string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(
    Number(BigInt(amountMinor)) / 100,
  )} ₽`;
}

function dateTime(value: Date) {
  return `${new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)} МСК`;
}

export function formatLeasePaymentReminderMessage(input: LeasePaymentReminderMessageInput) {
  const registration = input.registrationNumber ? ` · ${escapeHtml(input.registrationNumber)}` : '';
  return formatTelegramMessage({
    title: '⏰ <b>Завтра платёж по аренде с выкупом</b>',
    sections: [
      telegramSection('🚗', 'Авто', [`${escapeHtml(input.vehicle)}${registration}`]),
      telegramSection('👤', 'Клиент', [
        escapeHtml(input.clientName),
        `📄 Договор: <code>${escapeHtml(input.contractNumber ?? 'без номера')}</code>`,
        input.phone ? `📱 <code>${escapeHtml(input.phone)}</code>` : null,
      ]),
      telegramSection('💰', 'Платёж', [
        `№${input.paymentNumber} · <b>${escapeHtml(money(input.amountMinor))}</b>`,
        dateTime(input.dueAt),
      ]),
    ],
    action: input.action,
  });
}

export async function enqueueLeasePaymentReminders(
  now: Date,
  database: LeasePaymentReminderDatabase = prisma,
) {
  if (!isReminderWindow(now)) return 0;
  const dueDate = nextDateKey(moscowDateKey(now));
  const rentals = await database.rental.findMany({
    where: { agreementType: 'LEASE_TO_OWN', status: 'ACTIVE' },
    select: {
      id: true,
      companyId: true,
      snapshot: true,
      client: {
        select: { telegramIdentity: { select: { id: true, isActive: true } } },
      },
    },
    take: 500,
  });

  const rows: Prisma.BotNotificationJobCreateManyInput[] = [];
  for (const rental of rentals) {
    const payment = findDueLeasePayment(rental.snapshot, dueDate);
    if (!payment) continue;
    const payload = { rentalId: rental.id, paymentNumber: payment.number, dueDate };
    const eventKey = `lease-payment:${rental.companyId}:${rental.id}:${payment.number}:${dueDate}`;
    rows.push({
      companyId: rental.companyId,
      chatId: `staff:${rental.companyId}`,
      template: 'LEASE_TO_OWN_PAYMENT_STAFF',
      eventKey: `${eventKey}:staff`,
      payload,
      availableAt: now,
    });
    if (rental.client.telegramIdentity?.isActive) {
      rows.push({
        companyId: rental.companyId,
        identityId: rental.client.telegramIdentity.id,
        template: 'LEASE_TO_OWN_PAYMENT_CLIENT',
        eventKey: `${eventKey}:client`,
        payload,
        availableAt: now,
      });
    }
  }

  if (!rows.length) return 0;
  const result = await database.botNotificationJob.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}
