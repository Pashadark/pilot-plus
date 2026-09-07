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

type OperationalAlertMessageInput = {
  kind: GpsSilenceAlertKind | RentalDeadlineAlertKind | 'GEOFENCE_EXIT' | 'SPEEDING' | 'NEW_FINE';
  vehicle: string;
  registrationNumber: string | null;
  silentForMs?: number | null;
  clientName?: string | null;
  clientPhone?: string | null;
  rentalEndsAt?: Date | null;
  eventTitle?: string | null;
  eventDescription?: string | null;
  fineAmountMinor?: string | null;
  fineArticle?: string | null;
  fineAttributedToClient?: boolean;
};

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

export function formatOperationalAlert(input: OperationalAlertMessageInput) {
  const vehicle = `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`;
  const client = input.clientName
    ? `\n👤 ${escapeHtml(input.clientName)}${input.clientPhone ? ` · ${escapeHtml(input.clientPhone)}` : ''}`
    : '';
  const end = atMoscow(input.rentalEndsAt);
  switch (input.kind) {
    case 'RENTED_GPS_WARNING':
      return `🟠 <b>Потеря GPS-связи в аренде</b>\n${vehicle}\nНет связи ${escapeHtml(duration(input.silentForMs))}.${client}\n<b>Действие:</b> позвонить клиенту и уточнить местоположение.`;
    case 'RENTED_GPS_CRITICAL':
      return `🔴 <b>Критическая потеря GPS-связи</b>\n${vehicle}\nНет связи ${escapeHtml(duration(input.silentForMs))}.${client}\n<b>Действие:</b> срочно связаться с клиентом и проверить автомобиль.`;
    case 'RENTED_GPS_THEFT_RISK':
      return `🔴 <b>Срочно: машина без связи более 48 часов</b>\n${vehicle}\nНет связи ${escapeHtml(duration(input.silentForMs))}.${client}\n<b>Действие:</b> Срочно позвонить клиенту. Возможен угон или работа глушилки.`;
    case 'FREE_GPS_TRACKER_PROBLEM':
      return `🟠 <b>Проблема с трекером свободной машины</b>\n${vehicle}\nНет связи ${escapeHtml(duration(input.silentForMs))}.\n<b>Действие:</b> проверить АКБ, питание и SIM-карту трекера.`;
    case 'RETURN_SOON':
      return `⏰ <b>До возврата автомобиля осталось 2 часа</b>\n${vehicle}${client}${end ? `\nВозврат: ${escapeHtml(end)}` : ''}\n<b>Действие:</b> подтвердить с клиентом время возврата.`;
    case 'RETURN_OVERDUE':
      return `🔴 <b>Возврат просрочен более чем на 2 часа</b>\n${vehicle}${client}${end ? `\nПлановый возврат: ${escapeHtml(end)}` : ''}\n<b>Действие:</b> немедленно связаться с клиентом и напомнить о штрафных санкциях.`;
    case 'GEOFENCE_EXIT':
      return `🚨 <b>Автомобиль покинул геозону</b>\n${vehicle}${client}${input.eventDescription ? `\n${escapeHtml(input.eventDescription)}` : ''}\n<b>Действие:</b> немедленно проверить маршрут и связаться с клиентом.`;
    case 'SPEEDING':
      return `⚡ <b>Превышение скорости</b>\n${vehicle}${client}${input.eventTitle ? `\n${escapeHtml(input.eventTitle)}` : ''}${input.eventDescription ? `\n${escapeHtml(input.eventDescription)}` : ''}\n<b>Действие:</b> связаться с водителем и потребовать снизить скорость.`;
    case 'NEW_FINE': {
      const amount = input.fineAmountMinor
        ? new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            maximumFractionDigits: 0,
          }).format(Number(BigInt(input.fineAmountMinor) / BigInt(100)))
        : 'сумма не указана';
      return `🟡 <b>Новый штраф</b>\n${vehicle}${client}\n⚡ ${escapeHtml(amount)}${input.fineArticle ? ` · ${escapeHtml(input.fineArticle)}` : ''}\nНа клиента: <b>${input.fineAttributedToClient ? 'ДА' : 'НЕТ'}</b>\n<b>Действие:</b> проверить назначение штрафа и оплатить в разделе «Штрафы».`;
    }
  }
}
