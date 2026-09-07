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
  yesterday?: {
    revenueMinor: string;
    completedRentals: number;
    incidents: number;
    loadPercent: number;
  };
  fleet?: {
    rented: number;
    free: number;
    booked: number;
    maintenance: number;
    unknown: number;
    total: number;
  };
  criticalProblems?: Array<{
    vehicle: string;
    registrationNumber: string | null;
    details: string;
    action: string;
  }>;
  trackerProblems?: Array<{
    vehicle: string;
    registrationNumber: string | null;
    details: string;
    action: string;
  }>;
  newFines?: Array<{
    vehicle: string;
    registrationNumber: string | null;
    amountMinor: string;
    article: string | null;
    offenseAt: Date;
    attributedToClient: boolean;
  }>;
  finesApiAvailable?: boolean;
  leads?: Array<{
    at: Date | null;
    name: string;
    source: string | null;
    phone: string | null;
    overdue: boolean;
  }>;
  recommendations?: string[];
  weekly?: {
    startDate: string;
    endDate: string;
    revenueMinor: string;
    rentals: number;
    averageDurationDays: number;
    loadPercent: number;
  };
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

function problemSection(
  heading: string,
  items: OperationsDigestInput['criticalProblems'] | OperationsDigestInput['trackerProblems'],
) {
  if (!items?.length) return null;
  return [
    heading,
    ...items.map(
      (item, index) =>
        `${index + 1}. ${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>\n${escapeHtml(item.details)}\n<b>Действие:</b> ${escapeHtml(item.action)}`,
    ),
  ].join('\n\n');
}

function section<T>(heading: string, items: T[], card: (item: T) => string): string | null {
  if (!items.length) return null;
  return [
    heading,
    ...[...items]
      .sort((a, b) => {
        const left = (a as { at: Date }).at;
        const right = (b as { at: Date }).at;
        return left.getTime() - right.getTime();
      })
      .map(card),
  ].join('\n\n');
}

export function formatOperationsDigest(input: OperationsDigestInput): string {
  const fleetLoad = input.fleet?.total
    ? Math.round((input.fleet.rented / input.fleet.total) * 100)
    : null;
  const blocks: Array<string | null> = [
    [
      '🌙 <b>Сводка СУПА ПРО</b>',
      `<i>План работы на ${escapeHtml(digestDate(input.date))}</i>`,
      '',
      `📋 Заявки: <b>${input.requests}</b> · В аренде: <b>${input.activeRentals}</b> · Свободно: <b>${input.freeVehicles.length}</b>`,
    ].join('\n'),
    problemSection('🔴 <b>Критические проблемы</b>', input.criticalProblems),
    problemSection('🟠 <b>Проблемы с трекерами</b>', input.trackerProblems),
    input.newFines?.length
      ? [
          '🟡 <b>Новые штрафы за 24 часа</b>',
          ...input.newFines.map(
            (fine, index) =>
              `${index + 1}. ${escapeHtml(fine.vehicle)} · <code>${escapeHtml(fine.registrationNumber ?? 'без номера')}</code>\n⚡ ${escapeHtml(money(fine.amountMinor))}${fine.article ? ` · ${escapeHtml(fine.article)}` : ''}\n${escapeHtml(shortDateTime(fine.offenseAt))} · На клиента: <b>${fine.attributedToClient ? 'ДА' : 'НЕТ'}</b>`,
          ),
        ].join('\n\n')
      : input.finesApiAvailable === false
        ? '🟡 <b>Штрафы</b>\nШтрафы не проверены (API недоступен)'
        : null,
    input.yesterday
      ? [
          '📊 <b>Итоги вчера</b>',
          `💰 Выручка: <b>${escapeHtml(money(input.yesterday.revenueMinor))}</b>`,
          `📈 Загрузка парка: <b>${input.yesterday.loadPercent}%</b>`,
          `🏁 Завершено аренд: <b>${input.yesterday.completedRentals}</b>`,
          `⚠️ Инциденты: <b>${input.yesterday.incidents}</b>`,
        ].join('\n')
      : null,
    input.fleet
      ? [
          '📋 <b>Текущий статус</b>',
          `🚗 В аренде: <b>${input.fleet.rented}</b>`,
          `🅿️ Свободно: <b>${input.fleet.free}</b>`,
          `📅 Бронь: <b>${input.fleet.booked}</b>`,
          `🔧 Ремонт: <b>${input.fleet.maintenance}</b>`,
          `❓ Неизвестно: <b>${input.fleet.unknown}</b>`,
          `Загрузка парка: <b>${fleetLoad ?? 0}%</b>`,
        ].join('\n')
      : null,
    section('🚘 <b>Выдачи и подачи</b>', input.handovers, rentalCard),
    section('🔄 <b>Возвраты автомобилей</b>', input.returns, rentalCard),
    input.leads?.length
      ? [
          '📞 <b>Заявки на сегодня</b>',
          ...[...input.leads]
            .sort((left, right) => {
              if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
              return (
                (left.at?.getTime() ?? Number.MAX_SAFE_INTEGER) -
                (right.at?.getTime() ?? Number.MAX_SAFE_INTEGER)
              );
            })
            .map((lead) => {
              const when = lead.at ? `<code>${escapeHtml(time(lead.at))}</code>  ` : '';
              const late = lead.overdue ? '⚠️ ' : '';
              return `${when}${late}<b>${escapeHtml(lead.name)}</b>${lead.source ? ` · ${escapeHtml(lead.source)}` : ''}${lead.phone ? `\n☎️ ${escapeHtml(lead.phone)}` : ''}`;
            }),
        ].join('\n\n')
      : null,
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
    input.recommendations?.length
      ? [
          '🤖 <b>Рекомендации</b>',
          ...input.recommendations.map(
            (recommendation, index) => `${index + 1}. ${escapeHtml(recommendation)}`,
          ),
        ].join('\n')
      : null,
    input.weekly
      ? [
          '📊 <b>Недельный отчёт</b>',
          `<i>${escapeHtml(input.weekly.startDate)} — ${escapeHtml(input.weekly.endDate)}</i>`,
          `Выручка: <b>${escapeHtml(money(input.weekly.revenueMinor))}</b>`,
          `Загрузка: <b>${input.weekly.loadPercent}%</b>`,
          `Аренд: <b>${input.weekly.rentals}</b> · Средняя длительность: <b>${input.weekly.averageDurationDays} дн.</b>`,
        ].join('\n')
      : null,
  ];

  return blocks.filter((block): block is string => Boolean(block)).join('\n\n');
}
