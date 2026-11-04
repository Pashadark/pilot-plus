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

export type DigestMessagePart = {
  key: 'critical' | 'trackers' | 'totals';
  message: string;
};

function tree(rows: string[]): string {
  return rows.map((row, index) => `${index === rows.length - 1 ? '└' : '├'} ${row}`).join('\n');
}

function limited<T>(items: readonly T[], maximum: number) {
  return {
    visible: items.slice(0, maximum),
    hidden: Math.max(0, items.length - maximum),
  };
}

function hiddenLine(hidden: number): string[] {
  return hidden ? [`…и ещё ${hidden}`] : [];
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/gu, '');
  if (digits.length !== 11 || !['7', '8'].includes(digits[0])) return escapeHtml(value);
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

function moneyWithKopecks(minor: string): string {
  return `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(BigInt(minor)) / 100)} ₽`;
}

function digestProblemCards(
  items: NonNullable<OperationsDigestInput['criticalProblems']>,
  maximum = 20,
) {
  const { visible, hidden } = limited(items, maximum);
  return [
    ...visible.map((item, index) =>
      [
        `${index + 1}. <b>${escapeHtml(item.vehicle)}</b> · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>`,
        tree([`⏱ ${escapeHtml(item.details)}`, `⚡ ${escapeHtml(item.action)}`]),
      ].join('\n'),
    ),
    ...hiddenLine(hidden),
  ];
}

function criticalDigest(input: OperationsDigestInput): string {
  const fleet = input.fleet ?? {
    rented: input.activeRentals,
    free: input.freeVehicles.length,
    booked: 0,
    maintenance: 0,
    unknown: 0,
    total: input.activeRentals + input.freeVehicles.length,
  };
  const load = fleet.total ? Math.round((fleet.rented / fleet.total) * 100) : 0;
  const critical = input.criticalProblems ?? [];
  const recommendations = [...new Set(input.recommendations ?? [])];
  return [
    `🌙 <b>Сводка СУПА ПРО</b>\n📅 План работы на ${escapeHtml(digestDate(input.date))}`,
    [
      '📊 <b>Статус парка</b>',
      tree([
        `📋 Заявки: <b>${input.requests}</b>`,
        `🚗 В аренде: <b>${fleet.rented}</b>`,
        `🅿️ Свободно: <b>${fleet.free}</b>`,
        `📅 Бронь: <b>${fleet.booked}</b>`,
        `🔧 Ремонт: <b>${fleet.maintenance}</b>`,
        `❓ Неизвестно: <b>${fleet.unknown}</b>`,
      ]),
      `📈 Загрузка парка: <b>${load}%</b>`,
    ].join('\n'),
    critical.length
      ? [
          `🔴 <b>Критические проблемы (${critical.length})</b>`,
          ...digestProblemCards(critical),
        ].join('\n\n')
      : '✅ <b>Критических проблем нет</b>',
    recommendations.length
      ? [
          '🤖 <b>Рекомендации</b>',
          ...recommendations.slice(0, 10).map((item, index) => `${index + 1}. ${escapeHtml(item)}`),
          ...hiddenLine(Math.max(0, recommendations.length - 10)),
        ].join('\n')
      : '✅ <b>Дополнительных рекомендаций нет</b>',
  ].join('\n\n');
}

function trackersDigest(input: OperationsDigestInput): string {
  const trackers = input.trackerProblems ?? [];
  const offline = limited(input.offlineVehicles, 20);
  return [
    trackers.length
      ? [
          `🟠 <b>Проблемы с трекерами (${trackers.length})</b>`,
          ...digestProblemCards(trackers),
        ].join('\n\n')
      : '✅ <b>Проблем с трекерами нет</b>',
    input.offlineVehicles.length
      ? [
          `📡 <b>Нет GPS-связи (${input.offlineVehicles.length})</b>`,
          tree([
            ...offline.visible.map(
              (item) =>
                `${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code> — ${
                  item.lastSignalAt
                    ? escapeHtml(shortDateTime(item.lastSignalAt))
                    : 'сигнал ещё не получен'
                }`,
            ),
            ...hiddenLine(offline.hidden),
          ]),
        ].join('\n')
      : '✅ <b>Все автомобили на связи</b>',
  ].join('\n\n');
}

function totalsDigest(input: OperationsDigestInput): string {
  const returns = limited(
    [...input.returns].sort((left, right) => left.at.getTime() - right.at.getTime()),
    10,
  );
  const free = limited(input.freeVehicles, 20);
  const yesterday = input.yesterday;
  return [
    yesterday
      ? [
          '📊 <b>Итоги вчера</b>',
          tree([
            `💰 Выручка: <b>${escapeHtml(moneyWithKopecks(yesterday.revenueMinor))}</b>`,
            `📈 Загрузка парка: <b>${yesterday.loadPercent}%</b>`,
            `🏁 Завершено аренд: <b>${yesterday.completedRentals}</b>`,
            `⚠️ Инциденты: <b>${yesterday.incidents}</b>`,
          ]),
        ].join('\n')
      : '📊 <b>Итоги вчера</b>\n└ Данные ещё не рассчитаны',
    input.returns.length
      ? [
          `🔄 <b>Возвраты автомобилей (${input.returns.length})</b>`,
          ...returns.visible.map((item) => {
            const rows = [
              `${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>`,
              `👤 ${escapeHtml(item.client)}`,
            ];
            if (item.phone) rows.push(`☎️ <code>${formatPhone(item.phone)}</code>`);
            return `<code>${escapeHtml(time(item.at))}</code> · <code>${escapeHtml(item.contractNumber ?? 'без номера')}</code>\n${tree(rows)}`;
          }),
          ...hiddenLine(returns.hidden),
        ].join('\n\n')
      : '✅ <b>Возвратов на сегодня нет</b>',
    input.freeVehicles.length
      ? [
          `✅ <b>Свободные автомобили (${input.freeVehicles.length})</b>`,
          tree([
            ...free.visible.map(
              (item) =>
                `${escapeHtml(item.vehicle)} · <code>${escapeHtml(item.registrationNumber ?? 'без номера')}</code>`,
            ),
            ...hiddenLine(free.hidden),
          ]),
        ].join('\n')
      : '🚫 <b>Свободных автомобилей нет</b>',
  ].join('\n\n');
}

export function formatOperationsDigestParts(
  input: OperationsDigestInput,
): readonly [DigestMessagePart, DigestMessagePart, DigestMessagePart] {
  return [
    { key: 'critical', message: criticalDigest(input) },
    { key: 'trackers', message: trackersDigest(input) },
    { key: 'totals', message: totalsDigest(input) },
  ];
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
