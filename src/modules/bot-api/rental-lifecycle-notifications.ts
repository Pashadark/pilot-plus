type RentalLifecycleMessageInput = {
  kind: 'HANDOVER' | 'RETURN';
  occurredAt: Date;
  contractNumber: string | null;
  vehicle: string;
  registrationNumber: string | null;
  clientName: string;
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

export function formatRentalExtensionMessage(input: {
  vehicle: string;
  registrationNumber: string | null;
  clientName: string;
  contractNumber: string | null;
  actorName: string | null;
  occurredAt: Date;
  previousEndsAt: Date;
  nextEndsAt: Date;
  extensionChargeMinor: bigint;
}) {
  return [
    '📅 <b>Аренда продлена</b>',
    `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
    `👤 ${escapeHtml(input.clientName)}`,
    `📄 Договор: <code>${escapeHtml(input.contractNumber ?? 'без номера')}</code>`,
    `Было до: <b>${dateTime(input.previousEndsAt)}</b>`,
    `Продлено до: <b>${dateTime(input.nextEndsAt)}</b>`,
    `Доплата за продление: <b>${escapeHtml(new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(input.extensionChargeMinor) / 100))}</b>`,
    `🕒 Оформлено: ${dateTime(input.occurredAt)} (МСК)`,
    `👨‍💼 Оформил: ${escapeHtml(input.actorName ?? 'Сотрудник')}`,
  ].join('\n');
}

export function formatRentalLifecycleMessage(input: RentalLifecycleMessageInput) {
  const common = [
    `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`,
    `👤 ${escapeHtml(input.clientName)}`,
    `📄 Договор: <code>${escapeHtml(input.contractNumber ?? 'без номера')}</code>`,
  ];

  if (input.kind === 'HANDOVER') {
    return [
      '🚗 <b>Аренда началась</b>',
      ...common,
      `🛣 Пробег при выдаче: <b>${escapeHtml(integer(input.mileageKm))} км</b>`,
      `⛽ Топливо при выдаче: <b>${escapeHtml(integer(input.fuelLevelPercent))}%</b>`,
      `🕒 Выдано: <b>${escapeHtml(dateTime(input.occurredAt))}</b>`,
      `👨‍💼 Оформил: <b>${escapeHtml(input.actorName ?? 'Сотрудник')}</b>`,
    ].join('\n');
  }

  const distance =
    input.handoverMileageKm == null
      ? null
      : Math.max(0, Math.round(input.mileageKm - input.handoverMileageKm));
  const fuel =
    input.handoverFuelLevelPercent == null
      ? `${integer(input.fuelLevelPercent)}%`
      : `${integer(input.handoverFuelLevelPercent)}% → ${integer(input.fuelLevelPercent)}%`;
  return [
    '🏁 <b>Аренда завершена</b>',
    ...common,
    `🛣 Пробег при возврате: <b>${escapeHtml(integer(input.mileageKm))} км</b>`,
    ...(distance === null
      ? []
      : [`📏 Пробег за аренду: <b>${escapeHtml(integer(distance))} км</b>`]),
    `⛽ Топливо: <b>${escapeHtml(fuel)}</b>`,
    `🕒 Возвращено: <b>${escapeHtml(dateTime(input.occurredAt))}</b>`,
    `👨‍💼 Принял: <b>${escapeHtml(input.actorName ?? 'Сотрудник')}</b>`,
  ].join('\n');
}
