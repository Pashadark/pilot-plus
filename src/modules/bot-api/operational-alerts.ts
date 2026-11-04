import { formatTelegramMessage, telegramSection } from './telegram-message';

export type GpsSilenceAlertKind =
  | 'RENTED_GPS_WARNING'
  | 'RENTED_GPS_CRITICAL'
  | 'RENTED_GPS_THEFT_RISK'
  | 'FREE_GPS_TRACKER_PROBLEM';

export type RentalDeadlineAlertKind = 'RETURN_SOON' | 'RETURN_OVERDUE';

const HOUR_MS = 60 * 60_000;

export function classifyGpsSilence(input: {
  isRented: boolean;
  silentForMs: number;
}): GpsSilenceAlertKind | null {
  if (!Number.isFinite(input.silentForMs) || input.silentForMs < 0) return null;
  if (!input.isRented) {
    return input.silentForMs >= 48 * HOUR_MS ? 'FREE_GPS_TRACKER_PROBLEM' : null;
  }
  if (input.silentForMs >= 48 * HOUR_MS) return 'RENTED_GPS_THEFT_RISK';
  if (input.silentForMs >= 24 * HOUR_MS) return 'RENTED_GPS_CRITICAL';
  if (input.silentForMs >= 6 * HOUR_MS) return 'RENTED_GPS_WARNING';
  return null;
}

/** Positive means the deadline is already in the past. */
export function classifyRentalDeadline(overdueForMs: number): RentalDeadlineAlertKind | null {
  if (!Number.isFinite(overdueForMs)) return null;
  if (overdueForMs >= 2 * HOUR_MS) return 'RETURN_OVERDUE';
  if (overdueForMs >= -2 * HOUR_MS && overdueForMs <= 0) return 'RETURN_SOON';
  return null;
}

export type OperationalAlertMessageInput = {
  kind:
    | GpsSilenceAlertKind
    | RentalDeadlineAlertKind
    | 'GEOFENCE_EXIT'
    | 'SPEEDING'
    | 'HARSH_ACCELERATION'
    | 'HARSH_BRAKING'
    | 'NEW_FINE'
    | 'LOW_FUEL'
    | 'BORDER_APPROACH'
    | 'FUEL_STATION_VISIT'
    | 'IMPOUND_LOT_ENTRY';
  vehicle: string;
  registrationNumber: string | null;
  silentForMs?: number | null;
  clientName?: string | null;
  clientPhone?: string | null;
  rentalEndsAt?: Date | null;
  eventTitle?: string | null;
  eventDescription?: string | null;
  eventRecordedAt?: Date | null;
  fineAmountMinor?: string | null;
  fineDecreeNumber?: string | null;
  fineArticle?: string | null;
  fineDescription?: string | null;
  fineOffenseAt?: Date | null;
  fineAttributedToClient?: boolean;
  fuelLevelPercent?: number | null;
  borderCountry?: string | null;
  borderDistanceKm?: number | null;
  stationLabel?: string | null;
  impoundCity?: string | null;
  impoundAddress?: string | null;
};

export type OperationalAlertAudience = 'CLIENT' | 'MANAGER' | 'SUPER_ADMIN';

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function duration(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) return 'время неизвестно';
  const hours = Math.floor(value / HOUR_MS);
  const days = Math.floor(hours / 24);
  return days ? `${days} дн. ${hours % 24} ч.` : `${hours} ч.`;
}

function atMoscow(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

function phone(value: string | null | undefined) {
  if (!value) return null;
  let digits = value.replace(/\D/gu, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return /^7\d{10}$/u.test(digits)
    ? `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
    : value;
}

function vehicleBlock(input: OperationalAlertMessageInput, extra?: string) {
  const rows = [
    `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
    ...(extra ? [extra] : []),
  ];
  return `🚗 <b>Авто</b>\n${rows.map((row, index) => `${index === rows.length - 1 ? '└' : '├'} ${row}`).join('\n')}`;
}

function clientBlock(input: OperationalAlertMessageInput) {
  if (!input.clientName) return null;
  const clientPhone = phone(input.clientPhone);
  const rows = [
    escapeHtml(input.clientName),
    ...(clientPhone ? [`📱 ${escapeHtml(clientPhone)}`] : []),
  ];
  return `👤 <b>Клиент</b>\n${rows.map((row, index) => `${index === rows.length - 1 ? '└' : '├'} ${row}`).join('\n')}`;
}

function blocks(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join('\n\n');
}

function eventBlock(title: string, rows: Array<string | null | undefined>) {
  const visibleRows = rows.filter((row): row is string => Boolean(row));
  return `${title}\n${visibleRows.map((row, index) => `${index === visibleRows.length - 1 ? '└' : '├'} ${row}`).join('\n')}`;
}

const gpsActions: Record<
  'SPEEDING' | 'HARSH_ACCELERATION' | 'HARSH_BRAKING',
  Record<OperationalAlertAudience, string>
> = {
  SPEEDING: {
    CLIENT: 'Снизьте скорость и продолжайте движение безопасно',
    MANAGER: 'Связаться с водителем и потребовать снизить скорость',
    SUPER_ADMIN: 'Проверить обработку события ответственным менеджером',
  },
  HARSH_ACCELERATION: {
    CLIENT: 'Разгоняйтесь плавнее и продолжайте движение безопасно',
    MANAGER: 'Проверить маршрут и связаться с водителем',
    SUPER_ADMIN: 'Проверить обработку события ответственным менеджером',
  },
  HARSH_BRAKING: {
    CLIENT: 'Соблюдайте дистанцию и продолжайте движение безопасно',
    MANAGER: 'Проверить маршрут и связаться с водителем',
    SUPER_ADMIN: 'Проверить обработку события ответственным менеджером',
  },
};

function isGpsDrivingEvent(
  kind: OperationalAlertMessageInput['kind'],
): kind is 'SPEEDING' | 'HARSH_ACCELERATION' | 'HARSH_BRAKING' {
  return kind === 'SPEEDING' || kind === 'HARSH_ACCELERATION' || kind === 'HARSH_BRAKING';
}

export function formatOperationalAlertForAudience(
  input: OperationalAlertMessageInput,
  audience: OperationalAlertAudience,
) {
  if (!isGpsDrivingEvent(input.kind)) return formatOperationalAlert(input);

  const title =
    input.kind === 'HARSH_ACCELERATION'
      ? '🟠 <b>Резкий разгон</b>'
      : input.kind === 'HARSH_BRAKING'
        ? '🔵 <b>Резкое торможение</b>'
        : '⚡ <b>Превышение скорости</b>';

  return formatTelegramMessage({
    title,
    sections: [
      telegramSection('🚗', 'Авто', [
        `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
      ]),
      telegramSection('👤', 'Клиент', [input.clientName ? escapeHtml(input.clientName) : null]),
      telegramSection('📍', 'Событие', [
        input.eventTitle ? escapeHtml(input.eventTitle) : null,
        input.eventRecordedAt ? `${escapeHtml(atMoscow(input.eventRecordedAt))} МСК` : null,
        input.eventDescription ? escapeHtml(input.eventDescription) : null,
      ]),
    ],
    action: gpsActions[input.kind][audience],
  });
}

export function formatOperationalAlert(input: OperationalAlertMessageInput) {
  const end = atMoscow(input.rentalEndsAt);
  switch (input.kind) {
    case 'RENTED_GPS_WARNING':
      return blocks(
        '🟠 <b>Потеря GPS-связи в аренде</b>',
        vehicleBlock(input, `⏱ Нет связи: ${escapeHtml(duration(input.silentForMs))}`),
        clientBlock(input),
        '⚡ <b>Действие</b>\n└ Позвонить клиенту и уточнить местоположение',
      );
    case 'RENTED_GPS_CRITICAL':
      return blocks(
        '🔴 <b>Критическая потеря GPS-связи</b>',
        vehicleBlock(input, `⏱ Нет связи: ${escapeHtml(duration(input.silentForMs))}`),
        clientBlock(input),
        '⚡ <b>Действие</b>\n└ Срочно связаться с клиентом и проверить автомобиль',
      );
    case 'RENTED_GPS_THEFT_RISK':
      return blocks(
        '🔴 <b>Срочно: машина без связи более 48 часов</b>',
        vehicleBlock(input, `⏱ Нет связи: ${escapeHtml(duration(input.silentForMs))}`),
        clientBlock(input),
        '⚡ <b>Действие</b>\n└ Срочно позвонить клиенту. Возможен угон или работа глушилки',
      );
    case 'FREE_GPS_TRACKER_PROBLEM':
      return blocks(
        '🟠 <b>Проблема с трекером свободной машины</b>',
        vehicleBlock(input, `⏱ Нет связи: ${escapeHtml(duration(input.silentForMs))}`),
        '⚡ <b>Действие</b>\n└ Проверить АКБ, питание и SIM-карту трекера',
      );
    case 'RETURN_SOON':
      return blocks(
        '⏰ <b>До возврата автомобиля осталось 2 часа</b>',
        vehicleBlock(input),
        clientBlock(input),
        end ? `🗓 <b>Возврат</b>\n└ ${escapeHtml(end)} МСК` : null,
        '⚡ <b>Действие</b>\n└ Подтвердить с клиентом время возврата',
      );
    case 'RETURN_OVERDUE':
      return blocks(
        '🔴 <b>Возврат просрочен более чем на 2 часа</b>',
        vehicleBlock(input),
        clientBlock(input),
        end ? `🗓 <b>Плановый возврат</b>\n└ ${escapeHtml(end)} МСК` : null,
        '⚡ <b>Действие</b>\n└ Немедленно связаться с клиентом и напомнить о штрафных санкциях',
      );
    case 'GEOFENCE_EXIT':
      return blocks(
        '🚨 <b>Автомобиль покинул геозону</b>',
        vehicleBlock(input),
        clientBlock(input),
        eventBlock('📍 <b>Событие</b>', [
          input.eventDescription ? escapeHtml(input.eventDescription) : null,
          input.eventRecordedAt ? `${escapeHtml(atMoscow(input.eventRecordedAt))} МСК` : null,
        ]),
        '⚡ <b>Действие</b>\n└ Немедленно проверить маршрут и связаться с клиентом',
      );
    case 'SPEEDING':
      return blocks(
        '⚡ <b>Превышение скорости</b>',
        vehicleBlock(input),
        clientBlock(input) ?? '👤 <b>Клиент</b>\n└ Не определён',
        eventBlock('📍 <b>Событие</b>', [
          input.eventTitle ? escapeHtml(input.eventTitle) : null,
          input.eventRecordedAt ? `${escapeHtml(atMoscow(input.eventRecordedAt))} МСК` : null,
          input.eventDescription ? escapeHtml(input.eventDescription) : null,
        ]),
        '⚡ <b>Действие</b>\n└ Связаться с водителем и потребовать снизить скорость',
      );
    case 'HARSH_ACCELERATION':
      return blocks(
        '🟠 <b>Резкий разгон</b>',
        vehicleBlock(input),
        clientBlock(input) ?? '👤 <b>Клиент</b>\n└ Не определён',
        eventBlock('📍 <b>Событие</b>', [
          input.eventTitle ? escapeHtml(input.eventTitle) : null,
          input.eventRecordedAt ? `${escapeHtml(atMoscow(input.eventRecordedAt))} МСК` : null,
          input.eventDescription ? escapeHtml(input.eventDescription) : null,
        ]),
        '⚡ <b>Действие</b>\n└ Проверить маршрут и связаться с водителем',
      );
    case 'HARSH_BRAKING':
      return blocks(
        '🔵 <b>Резкое торможение</b>',
        vehicleBlock(input),
        clientBlock(input) ?? '👤 <b>Клиент</b>\n└ Не определён',
        eventBlock('📍 <b>Событие</b>', [
          input.eventTitle ? escapeHtml(input.eventTitle) : null,
          input.eventRecordedAt ? `${escapeHtml(atMoscow(input.eventRecordedAt))} МСК` : null,
          input.eventDescription ? escapeHtml(input.eventDescription) : null,
        ]),
        '⚡ <b>Действие</b>\n└ Проверить маршрут и связаться с водителем',
      );
    case 'NEW_FINE': {
      const amount = input.fineAmountMinor
        ? new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(Number(input.fineAmountMinor) / 100)
        : 'сумма не указана';
      const offenseAt = atMoscow(input.fineOffenseAt);
      return blocks(
        `🚨 <b>Штраф на ${escapeHtml(amount)}</b>`,
        vehicleBlock(
          input,
          `${input.fineAttributedToClient ? '✅' : '⚠️'} На клиента: <b>${input.fineAttributedToClient ? 'да' : 'нет'}</b>`,
        ),
        clientBlock(input),
        [
          '📄 <b>Постановление</b>',
          `├ № <code>${escapeHtml(input.fineDecreeNumber?.trim() || 'не предоставлен')}</code>`,
          `├ 📅 ${offenseAt ? `${escapeHtml(offenseAt)} МСК` : 'Дата нарушения не предоставлена'}`,
          `└ ⚡ ${escapeHtml(input.fineDescription?.trim() || 'Описание не предоставлено')}`,
          ...(input.fineArticle ? [`⚖️ Статья: ${escapeHtml(input.fineArticle)}`] : []),
        ].join('\n'),
      );
    }
    case 'LOW_FUEL': {
      const fuel = Math.round(Math.max(0, Math.min(100, input.fuelLevelPercent ?? 0)));
      return blocks(
        '⛽ <b>Низкий уровень топлива</b>',
        vehicleBlock(input),
        eventBlock('⛽ <b>Топливо</b>', [`Осталось: <b>${escapeHtml(fuel)}%</b>`]),
        '⚡ <b>Действие</b>\n└ заправить автомобиль перед следующей выдачей',
      );
    }
    case 'BORDER_APPROACH': {
      const distance =
        input.borderDistanceKm == null
          ? 'расстояние неизвестно'
          : `${input.borderDistanceKm.toFixed(1)} км`;
      return blocks(
        '⚠️ <b>Машина приближается к границе</b>',
        vehicleBlock(input),
        clientBlock(input),
        [
          '🌍 <b>Граница</b>',
          `├ Страна: <b>${escapeHtml(input.borderCountry ?? 'сопредельное государство')}</b>`,
          `├ 📏 Расстояние: ${escapeHtml(distance)}`,
          `└ 🕒 Время: ${escapeHtml(atMoscow(input.eventRecordedAt) ?? 'не указано')} МСК`,
        ].join('\n'),
        '⚡ <b>Действие</b>\n└ Проверьте маршрут и связь с водителем',
      );
    }
    case 'FUEL_STATION_VISIT':
      return blocks(
        '⛽ <b>Возможная заправка</b>',
        vehicleBlock(input),
        clientBlock(input),
        eventBlock('📍 <b>АЗС</b>', [
          `<b>${escapeHtml(input.stationLabel ?? 'название неизвестно')}</b>`,
          input.eventRecordedAt
            ? `Въезд: ${escapeHtml(atMoscow(input.eventRecordedAt))} МСК`
            : null,
          'Стоянка: 7 мин.',
        ]),
        '⚡ <b>Действие</b>\n└ Проверить факт и сумму заправки',
      );
    case 'IMPOUND_LOT_ENTRY':
      return blocks(
        '🚨 <b>Автомобиль на территории штрафстоянки</b>',
        vehicleBlock(input),
        clientBlock(input),
        eventBlock('📍 <b>Штрафстоянка</b>', [
          escapeHtml(input.impoundCity ?? 'Город не определён'),
          escapeHtml(input.impoundAddress ?? 'Адрес не определён'),
          input.eventRecordedAt ? `${escapeHtml(atMoscow(input.eventRecordedAt))} МСК` : null,
        ]),
        '⚡ <b>Действие</b>\n└ Срочно связаться с клиентом и проверить эвакуацию',
      );
  }
}

export function formatClientGpsEvent(
  input: Pick<
    OperationalAlertMessageInput,
    | 'kind'
    | 'vehicle'
    | 'registrationNumber'
    | 'eventTitle'
    | 'eventDescription'
    | 'eventRecordedAt'
  >,
) {
  return blocks(
    formatOperationalAlertForAudience(input, 'CLIENT'),
    'ℹ️ <b>Важно</b>\n└ Это GPS-событие, а не постановление о штрафе.',
  );
}
