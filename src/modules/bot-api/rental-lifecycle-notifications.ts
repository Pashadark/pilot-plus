type RentalLifecycleMessageInput = {
  kind: 'HANDOVER' | 'RETURN';
  occurredAt: Date;
  contractNumber: string | null;
  vehicle: string;
  registrationNumber: string | null;
  clientName: string;
  clientPhone?: string | null;
  actorName: string | null;
  mileageKm: number;
  fuelLevelPercent: number;
  handoverMileageKm?: number | null;
  handoverFuelLevelPercent?: number | null;
};

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function integer(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

function readablePhone(value: string | null | undefined) {
  return value?.trim() || 'телефон не указан';
}

export function formatRentalExtensionMessage(input: {
  vehicle: string;
  registrationNumber: string | null;
  clientName: string;
  clientPhone?: string | null;
  contractNumber: string | null;
  actorName: string | null;
  occurredAt: Date;
  previousEndsAt: Date;
  nextEndsAt: Date;
  extensionChargeMinor: bigint;
}) {
  return formatTelegramMessage({
    title: '📅 <b>Аренда продлена</b>',
    sections: [
      telegramSection('🚗', 'Авто', [
        `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
        `📄 Договор: <code>${escapeHtml(input.contractNumber ?? 'без номера')}</code>`,
      ]),
      telegramSection('👤', 'Клиент', [
        escapeHtml(input.clientName),
        input.clientPhone ? `📱 ${escapeHtml(input.clientPhone)}` : null,
      ]),
      telegramSection('🗓', 'Новый срок', [
        `Было до: <b>${dateTime(input.previousEndsAt)}</b>`,
        `Продлено до: <b>${dateTime(input.nextEndsAt)}</b>`,
      ]),
      telegramSection('💰', 'Доплата', [
        escapeHtml(
          new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(
            Number(input.extensionChargeMinor) / 100,
          ),
        ),
      ]),
      telegramSection('🕒', 'Операция', [
        `${dateTime(input.occurredAt)} МСК`,
        `Оформил: ${escapeHtml(input.actorName ?? 'Сотрудник')}`,
      ]),
    ],
  });
}

export function formatRentalLifecycleMessage(input: RentalLifecycleMessageInput) {
  const common = [
    telegramSection('🚗', 'Авто', [
      `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
      `📄 Договор: <code>${escapeHtml(input.contractNumber ?? 'без номера')}</code>`,
    ]),
    telegramSection('👤', 'Клиент', [
      escapeHtml(input.clientName),
      input.clientPhone ? `📱 ${escapeHtml(input.clientPhone)}` : null,
    ]),
  ];

  if (input.kind === 'HANDOVER') {
    return formatTelegramMessage({
      title: '🚗 <b>Аренда началась</b>',
      sections: [
        ...common,
        telegramSection('📊', 'Выдача', [
          `Пробег: <b>${escapeHtml(integer(input.mileageKm))} км</b>`,
          `Топливо: <b>${escapeHtml(integer(input.fuelLevelPercent))}%</b>`,
          `Выдано: <b>${escapeHtml(dateTime(input.occurredAt))} МСК</b>`,
          `Оформил: <b>${escapeHtml(input.actorName ?? 'Сотрудник')}</b>`,
        ]),
      ],
    });
  }

  const distance =
    input.handoverMileageKm == null
      ? null
      : Math.max(0, Math.round(input.mileageKm - input.handoverMileageKm));
  const fuel =
    input.handoverFuelLevelPercent == null
      ? `${integer(input.fuelLevelPercent)}%`
      : `${integer(input.handoverFuelLevelPercent)}% → ${integer(input.fuelLevelPercent)}%`;
  return formatTelegramMessage({
    title: '🏁 <b>Аренда завершена</b>',
    sections: [
      ...common,
      telegramSection('📊', 'Возврат', [
        `Пробег: <b>${escapeHtml(integer(input.mileageKm))} км</b>`,
        distance === null ? null : `За аренду: <b>${escapeHtml(integer(distance))} км</b>`,
        `Топливо: <b>${escapeHtml(fuel)}</b>`,
        `Возвращено: <b>${escapeHtml(dateTime(input.occurredAt))} МСК</b>`,
        `Принял: <b>${escapeHtml(input.actorName ?? 'Сотрудник')}</b>`,
      ]),
    ],
  });
}

export function formatTomorrowReturnMessage(input: {
  vehicle: string;
  registrationNumber: string | null;
  clientName: string;
  clientPhone?: string | null;
  contractNumber: string | null;
  endsAt: Date;
}) {
  return formatTelegramMessage({
    title: '⏰ <b>Завтра возврат автомобиля</b>',
    sections: [
      telegramSection('🚗', 'Авто', [
        `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
      ]),
      telegramSection('👤', 'Клиент', [
        escapeHtml(input.clientName),
        `📄 Договор: <code>${escapeHtml(input.contractNumber ?? 'без номера')}</code>`,
        `📱 ${escapeHtml(readablePhone(input.clientPhone))}`,
      ]),
      telegramSection('🗓', 'Возврат', [`${escapeHtml(dateTime(input.endsAt))} МСК`]),
    ],
    action: 'Связаться с клиентом и подтвердить время возврата',
  });
}
import { formatTelegramMessage, telegramSection } from './telegram-message';

export function formatClientReturnReminderMessage(input: {
  stage: '24h' | '3h' | '30m' | null;
  manual: boolean;
  vehicle: string;
  registrationNumber: string | null;
  contractNumber: string | null;
  endsAt: Date;
}) {
  const title = input.manual
    ? '🔔 <b>Напоминание о возврате автомобиля</b>'
    : input.stage === '24h'
      ? '⏰ <b>Скоро возврат автомобиля</b>'
      : input.stage === '3h'
        ? '⏰ <b>До возврата осталось 3 часа</b>'
        : '🔴 <b>До возврата осталось 30 минут</b>';
  const action =
    input.stage === '24h'
      ? 'Если хотите продлить аренду, отправьте запрос менеджеру'
      : input.stage === '3h'
        ? 'Проверьте топливо и условия по мойке перед возвратом'
        : 'Если опаздываете, немедленно свяжитесь с менеджером';
  return formatTelegramMessage({
    title,
    sections: [
      telegramSection('🚗', 'Авто', [
        `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
      ]),
      telegramSection('📄', 'Договор', [
        `№ <code>${escapeHtml(input.contractNumber ?? 'без номера')}</code>`,
      ]),
      telegramSection('🗓', 'Возврат', [`${escapeHtml(dateTime(input.endsAt))} МСК`]),
    ],
    action,
  });
}
