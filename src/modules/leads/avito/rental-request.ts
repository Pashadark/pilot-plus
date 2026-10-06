import { record, summarizeRequest } from './message';
import { normalizeDateLanguage } from './date-language';

export type RentalRequest = {
  model: string | null;
  startsAt: string | null;
  endsAt: string | null;
  days: number | null;
  mileageKm: number | null;
  phone: string | null;
  startDay?: string | null;
  endDay?: string | null;
  pickupTime?: string | null;
  returnTime?: string | null;
};

export const approvedRentalIds = new Set([
  '8304026669',
  '8302575961',
  '8285464541',
  '8285429320',
  '8253652565',
  '8253600082',
  '8253429766',
  '8253315004',
  '8253296130',
  '8253153996',
  '8252873021',
]);

export function eligibleRentalAd(chat: unknown, account: string, activeIds: ReadonlySet<string>) {
  const context = record(record(chat).context);
  const item = record(context.value);
  const id = String(item.id ?? '');
  return (
    context.type === 'item' &&
    String(item.user_id) === account &&
    approvedRentalIds.has(id) &&
    activeIds.has(id) &&
    typeof item.title === 'string' &&
    /^Аренда\s/iu.test(item.title.trim())
  );
}

const models: [string, RegExp][] = [
  ['Toyota Camry', /(?<![\p{L}\d])(?:camry|камри)(?![\p{L}\d])/iu],
  ['Volkswagen Polo', /(?<![\p{L}\d])(?:polo|поло)(?![\p{L}\d])/iu],
  ['Kia Cerato', /(?<![\p{L}\d])(?:cerato|церато)(?![\p{L}\d])/iu],
  ['Kia Sorento', /(?<![\p{L}\d])(?:sorento|соренто)(?![\p{L}\d])/iu],
  ['Skoda Karoq', /(?<![\p{L}\d])(?:karoq|карок)(?![\p{L}\d])/iu],
  ['Skoda Octavia', /(?<![\p{L}\d])(?:octavia|октавия|октавию)(?![\p{L}\d])/iu],
  ['Kia Rio', /(?<![\p{L}\d])(?:rio|рио)(?![\p{L}\d])/iu],
  ['Kia K5', /(?<![\p{L}\d])(?:k5|к5)(?![\p{L}\d])/iu],
  ['Kia Ceed', /(?<![\p{L}\d])(?:ceed|сид)(?![\p{L}\d])/iu],
  ['Toyota Land Cruiser', /land\s*cruiser|ленд\s*крузер|ланд\s*крузер/iu],
  ['BMW 5', /(?:bmw|бмв)\s*(?:5|пят[а-я]*)(?!\d)/iu],
  ['Mercedes-Benz E', /(?:mercedes|мерседес)(?:-benz)?\s*[еe](?:[-\s]класс)?(?![\p{L}])/iu],
];

function moscowDate(parts: string[]) {
  const [day, month, year, hour, minute] = parts.map(Number);
  if (hour > 23 || minute > 59 || year < 2026 || year > 2100) return null;
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day
  )
    return null;
  return new Date(local.getTime() - 3 * 3600000);
}

function calendarRange(text: string, now: Date) {
  const matches = [
    ...text.matchAll(
      /(?<![\d./])(?:с\s+)?(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?![\d./])(?:\s+(?:в\s+)?(\d{1,2}):(\d{2}))?\s*(?:по|до|—|–|-)\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?![\d./])(?:\s+(?:в\s+)?(\d{1,2}):(\d{2}))?/giu,
    ),
  ];
  if (matches.length !== 1) return null;
  const m = matches[0];
  const today = new Date(now.getTime() + 10800000).toISOString().slice(0, 10);
  const year = m[3] ?? today.slice(0, 4);
  const endYear = m[8] ?? String(Number(year) + (m[2] === '12' && Number(m[7]) === 1 ? 1 : 0));
  const start = moscowDate([m[1], m[2], year, '0', '0']);
  const end = moscowDate([m[6], m[7], endYear, '0', '0']);
  if (!start || !end || end < start || end.getTime() - start.getTime() > 366 * 86400000)
    return null;
  const startDay = new Date(start.getTime() + 10800000).toISOString().slice(0, 10);
  if (startDay < today) return null;
  const validTime = (hour: string | undefined, minute: string | undefined) =>
    hour !== undefined && Number(hour) <= 23 && Number(minute) <= 59
      ? hour.padStart(2, '0') + ':' + minute
      : null;
  if ((m[4] && !validTime(m[4], m[5])) || (m[9] && !validTime(m[9], m[10]))) return null;
  return {
    startDay,
    endDay: new Date(end.getTime() + 10800000).toISOString().slice(0, 10),
    pickupTime: validTime(m[4], m[5]),
    returnTime: validTime(m[9], m[10]),
  };
}

/** Conservative extraction: incomplete/ambiguous facts remain null for a human to clarify. */
export function extractRentalRequest(text: string, now: Date): RentalRequest {
  text = normalizeDateLanguage(text, now);
  const found = models.filter(([, expression]) => expression.test(text));
  const words: Record<string, number> = {
    один: 1,
    два: 2,
    три: 3,
    четыре: 4,
    пять: 5,
    шесть: 6,
    семь: 7,
    восемь: 8,
    девять: 9,
    десять: 10,
  };
  const durationValues = [
    ...new Set(
      [
        ...text.matchAll(
          /(?<![\p{L}\d])(?:на\s+)?(\d{1,3}|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\s*(день|дня|дней|сутки|суток|неделю|недели|недель)(?!\p{L})/giu,
        ),
      ].map((m) => (words[m[1].toLowerCase()] ?? Number(m[1])) * (m[2].startsWith('нед') ? 7 : 1)),
    ),
  ];
  const mileage = [
    ...new Set(
      [
        ...text.matchAll(
          /(?:общий\s+(?:планируемый\s+)?пробег|за\s+весь\s+(?:срок|период)|всего)\s*[:—-]?\s*(\d[\d ]{0,7})\s*км(?!\s*(?:в|за)\s*(?:день|сутки))/giu,
        ),
      ].map((m) => Number(m[1].replace(/\s/g, ''))),
    ),
  ];
  const ranges = [
    ...text.matchAll(
      /(?:с\s+)?(\d{1,2})[./](\d{1,2})[./](\d{4})\s+(?:в\s+)?(\d{1,2}):(\d{2})\s*(?:по|до|—|–|-)\s*(\d{1,2})[./](\d{1,2})[./](\d{4})\s+(?:в\s+)?(\d{1,2}):(\d{2})/giu,
    ),
  ];
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  if (ranges.length === 1) {
    const start = moscowDate(ranges[0].slice(1, 6));
    const end = moscowDate(ranges[0].slice(6, 11));
    if (
      start &&
      end &&
      start >= now &&
      end > start &&
      end.getTime() - start.getTime() <= 366 * 86400000
    ) {
      startsAt = start.toISOString();
      endsAt = end.toISOString();
    }
  }
  const relative = [
    ...new Set(
      [...text.matchAll(/(?<!\p{L})(сегодня|завтра|послезавтра)(?!\p{L})/giu)].map((m) =>
        m[1].toLowerCase(),
      ),
    ),
  ];
  let startDay: string | null = null;
  const single = /(?<!\p{L})с\s+(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?![\d./])/iu.exec(text);
  if (single && !/\s(?:по|до)\s|\d\s*[-–—]\s*\d/iu.test(text)) {
    const today = new Date(now.getTime() + 10800000).toISOString().slice(0, 10);
    const date = moscowDate([single[1], single[2], single[3] ?? today.slice(0, 4), '0', '0']);
    const day = date ? new Date(date.getTime() + 10800000).toISOString().slice(0, 10) : null;
    if (day && day >= today) startDay = day;
  }
  if (relative.length === 1) {
    const offset = relative[0] === 'сегодня' ? 0 : relative[0] === 'завтра' ? 1 : 2;
    startDay = new Date(now.getTime() + 3 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
  }
  if (!startDay && startsAt)
    startDay = new Date(Date.parse(startsAt) + 3 * 3600000).toISOString().slice(0, 10);
  const times = [
    ...new Set(
      [...text.matchAll(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/gu)].map(
        (m) => m[1].padStart(2, '0') + ':' + m[2],
      ),
    ),
  ];
  const request: RentalRequest = {
    model: found.length === 1 ? found[0][0] : null,
    startsAt,
    endsAt,
    days: durationValues.length === 1 && durationValues[0] > 0 ? durationValues[0] : null,
    mileageKm: mileage.length === 1 && mileage[0] > 0 && mileage[0] <= 100000 ? mileage[0] : null,
    phone: summarizeRequest(text).phone || null,
    startDay,
    pickupTime: times.length === 1 ? times[0] : null,
  };
  const calendar = calendarRange(text, now);
  if (calendar) {
    Object.assign(request, calendar);
    request.days = null;
    const pickup =
      /(?:заберу|получу|получение|выдача)\s*(?:в\s*)?([01]?\d|2[0-3]):([0-5]\d)/iu.exec(text);
    const dropoff = /(?:верну|возврат|сдам)\s*(?:в\s*)?([01]?\d|2[0-3]):([0-5]\d)/iu.exec(text);
    if (pickup) request.pickupTime = pickup[1].padStart(2, '0') + ':' + pickup[2];
    if (dropoff) request.returnTime = dropoff[1].padStart(2, '0') + ':' + dropoff[2];
  }
  return deriveInterval(request, now);
}

function deriveInterval(request: RentalRequest, now: Date): RentalRequest {
  if (request.startDay && request.endDay) {
    // Calendar dates never imply pickup/return hours or a 24-hour billing period.
    if (!request.pickupTime || !request.returnTime)
      return { ...request, startsAt: null, endsAt: null };
    const start = new Date(`${request.startDay}T${request.pickupTime}:00+03:00`);
    const end = new Date(`${request.endDay}T${request.returnTime}:00+03:00`);
    return start >= now && end > start
      ? { ...request, startsAt: start.toISOString(), endsAt: end.toISOString() }
      : { ...request, startsAt: null, endsAt: null };
  }
  if (
    !request.startsAt &&
    request.startDay &&
    request.pickupTime &&
    request.days &&
    request.days <= 366
  ) {
    const start = new Date(`${request.startDay}T${request.pickupTime}:00+03:00`);
    if (Number.isFinite(start.getTime()) && start >= now)
      return {
        ...request,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + request.days * 86400000).toISOString(),
      };
  }
  return request;
}

export function extractRentalConversation(messages: { text: string; at: string }[]): RentalRequest {
  const reference = messages.length ? new Date(messages[messages.length - 1].at) : new Date();
  const combined = extractRentalRequest(
    messages.map((m) => normalizeDateLanguage(m.text, new Date(m.at))).join('\n'),
    reference,
  );
  const days = [
    ...new Set(
      messages
        .map((m) => extractRentalRequest(m.text, new Date(m.at)).startDay)
        .filter((day): day is string => Boolean(day)),
    ),
  ];
  // Re-derive relative intervals from the date of the message that supplied the day.
  if (days.length === 1) {
    const hasRelative = messages.some((m) =>
      /(?<!\p{L})(сегодня|завтра|послезавтра)(?!\p{L})/iu.test(m.text),
    );
    return deriveInterval(
      { ...combined, startDay: days[0], ...(hasRelative ? { startsAt: null, endsAt: null } : {}) },
      reference,
    );
  }
  if (days.length > 1) return { ...combined, startDay: null, startsAt: null, endsAt: null };
  return combined;
}

export function rentalQuestions(request: RentalRequest) {
  const questions: string[] = [];
  if (!request.model) questions.push('Какой автомобиль вас интересует?');
  if (!request.startsAt || !request.endsAt)
    questions.push(
      request.startDay
        ? request.endDay
          ? 'Уточните, пожалуйста, время получения и возврата автомобиля.'
          : request.days
            ? 'Во сколько планируете получить автомобиль?'
            : 'Во сколько планируете получить автомобиль и на сколько дней?'
        : 'На какие даты и время нужна аренда?',
    );
  if (!request.mileageKm) questions.push('Какой общий пробег планируете за весь срок?');
  if (!request.phone) questions.push('Оставьте, пожалуйста, контактный телефон.');
  return questions.length ? 'Здравствуйте! ' + questions.join(' ') : '';
}
