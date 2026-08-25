const MOSCOW_TIME_ZONE = 'Europe/Moscow';

export type DigestRentalItem = {
  at: Date;
  title: string;
  contractNumber: string | null;
  vehicle: string;
  registrationNumber: string | null;
  client: string;
  phone: string | null;
  amountMinor?: string | null;
  overdue?: boolean;
};

export type DigestServiceItem = {
  at: Date;
  title: string;
  vehicle: string;
  registrationNumber: string | null;
  overdue?: boolean;
};

export type DigestOfflineVehicle = {
  vehicle: string;
  registrationNumber: string | null;
  lastSignalAt: Date | null;
};

export type OperationsDigestInput = {
  date: string;
  requests: number;
  activeRentals: number;
  handovers: DigestRentalItem[];
  returns: DigestRentalItem[];
  deposits: DigestRentalItem[];
  washes: DigestServiceItem[];
  maintenance: DigestServiceItem[];
  offlineVehicles: DigestOfflineVehicle[];
  freeVehicles: Array<{ vehicle: string; registrationNumber: string | null }>;
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function time(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function shortDateTime(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(value)
    .replace(',', ',');
}

function digestDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, day, 9)));
}

function money(minor: string): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(BigInt(minor) / BigInt(100)));
}

function rentalCard(item: DigestRentalItem): string {
  const title = item.overdue
    ? `⚠️ <b>Просрочено:</b> ${escapeHtml(item.title)}`
    : `<b>${escapeHtml(item.title)}</b>`;
  const lines = [
    `<code>${escapeHtml(time(item.at))}</code>  ${title}`,
    `<code>${escapeHtml(item.contractNumber ?? 'без номера')}</code>`,
    `${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>`,
    escapeHtml(item.client),
  ];
  if (item.phone) lines.push(`☎️ ${escapeHtml(item.phone)}`);
  if (item.amountMinor) lines.push(`💵 ${escapeHtml(money(item.amountMinor))}`);
  return lines.join('\n');
}

function serviceCard(item: DigestServiceItem): string {
  const title = item.overdue
    ? `⚠️ <b>Просрочено:</b> ${escapeHtml(item.title)}`
    : `<b>${escapeHtml(item.title)}</b>`;
  return [
    `<code>${escapeHtml(time(item.at))}</code>  ${title}`,
    `${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>`,
  ].join('\n');
}

function section<T>(heading: string, items: T[], card: (item: T) => string): string | null {
  if (!items.length) return null;
  return [heading, ...[...items].sort((a, b) => {
    const left = (a as { at: Date }).at;
    const right = (b as { at: Date }).at;
    return left.getTime() - right.getTime();
  }).map(card)].join('\n\n');
}

export function formatOperationsDigest(input: OperationsDigestInput): string {
  const blocks: Array<string | null> = [
    [
      '🌙 <b>Сводка СУПА ПРО</b>',
      `<i>План работы на ${escapeHtml(digestDate(input.date))}</i>`,
      '',
      `📋 Заявки: <b>${input.requests}</b> · В аренде: <b>${input.activeRentals}</b> · Свободно: <b>${input.freeVehicles.length}</b>`,
    ].join('\n'),
    section('🚘 <b>Выдачи и подачи</b>', input.handovers, rentalCard),
    section('🔄 <b>Возвраты автомобилей</b>', input.returns, rentalCard),
    section('💰 <b>Возврат депозитов</b>', input.deposits, rentalCard),
    section('🧼 <b>Мойки</b>', input.washes, serviceCard),
    section('🔧 <b>Техническое обслуживание</b>', input.maintenance, serviceCard),
    input.offlineVehicles.length
      ? [
          '📡 <b>Нет GPS-связи</b>',
          ...input.offlineVehicles.map((item) =>
            [
              `${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>`,
              item.lastSignalAt
                ? `<i>Последний сигнал: ${escapeHtml(shortDateTime(item.lastSignalAt))}</i>`
                : '<i>Сигнал ещё не получен</i>',
            ].join('\n'),
          ),
        ].join('\n\n')
      : null,
    input.freeVehicles.length
      ? [
          '✅ <b>Свободные автомобили</b>',
          ...input.freeVehicles.map(
            (item) =>
              `${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>`,
          ),
        ].join('\n')
      : null,
  ];

  return blocks.filter((block): block is string => Boolean(block)).join('\n\n');
}
