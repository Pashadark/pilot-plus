import { createHash } from 'node:crypto';

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const safeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w:-]{1,150}$/.test(value);
export function avitoId(company: string, account: string, chat: string, message?: string) {
  return (
    'avito_' +
    createHash('sha256')
      .update(JSON.stringify([company, account, chat, message ?? null]))
      .digest('hex')
      .slice(0, 40)
  );
}
export function parseCallback(value: unknown, accountId: string) {
  const payload = record(record(value).payload),
    event = record(payload.value);
  if (
    payload.type !== 'message' ||
    String(event.user_id) !== accountId ||
    !safeId(event.id) ||
    !safeId(event.chat_id)
  )
    return null;
  return { messageId: event.id, chatId: event.chat_id };
}
export function incomingMessage(value: unknown, accountId: string, enabledAt: Date) {
  const m = record(value);
  if (
    !safeId(m.id) ||
    m.direction !== 'in' ||
    String(m.author_id) === accountId ||
    !Number.isSafeInteger(m.author_id) ||
    !Number.isFinite(enabledAt.getTime())
  )
    return null;
  if (
    typeof m.created !== 'number' ||
    !Number.isFinite(m.created) ||
    m.created * 1000 < enabledAt.getTime() ||
    m.created * 1000 > Date.now() + 300000
  )
    return null;
  if (m.type === 'system' || typeof m.type !== 'string') return null;
  const content = record(m.content);
  const text =
    m.type === 'text' && typeof content.text === 'string'
      ? content.text.slice(0, 16000)
      : `[Сообщение типа ${m.type.slice(0, 40)} — откройте чат Авито]`;
  if (!text.trim()) return null;
  return { id: m.id, authorId: String(m.author_id), createdAt: new Date(m.created * 1000), text };
}
export function summarizeRequest(text: string) {
  const phones = [
    ...new Set(
      (text.match(/(?<!\d)(?:\+7|8|7)(?:[\p{Zs}\p{P}]*\d)+/gu) ?? [])
        .map((p) => p.replace(/\D/g, ''))
        .filter((p) => p.length === 11)
        .map((p) => '7' + p.slice(1)),
    ),
  ];
  const durations = [
    ...new Set(
      [
        ...text.matchAll(
          /(?:на|срок(?:ом)?)\s+(\d{1,3})\s*(дн(?:я|ей|ь)?|сут(?:ки|ок)?|недел(?:ю|и|ь))/gi,
        ),
      ].map((m) => Number(m[1]) * (m[2].toLowerCase().startsWith('нед') ? 7 : 1)),
    ),
  ];
  const models = [
    ...new Set(
      text.match(
        /Camry|Камри|Polo|Поло|Cerato|Церато|Sorento|Соренто|Karoq|Карок|Octavia|Октавия|Kia\s+Rio|Киа\s+Рио|Kia\s+K5|Киа\s+К5|Mercedes|Мерседес|BMW|БМВ/gi,
      ) ?? [],
    ),
  ];
  const dateRange = text.match(
    /(?:с\s+)?\d{1,2}[./]\d{1,2}(?:[./]\d{4})?\s*(?:по|до|—|–|-)\s*\d{1,2}[./]\d{1,2}(?:[./]\d{4})?/i,
  )?.[0];
  const budget = text.match(
    /(?:бюджет|до)\s*[:—-]?\s*(?:до\s+)?\d[\d ]{1,8}\s*(?:₽|руб(?:лей|ля|ль)?\.?)(?:\s*(?:в|за)\s*(?:сутки|день))?/i,
  )?.[0];
  const pickup = text.match(/(?:подача|доставить|адрес)\s*[:—-]\s*([^\n!?]{3,160})/i)?.[1];
  const lines = [
    `Длительность: ${durations.length === 1 && durations[0] > 0 ? durations[0] + ' дней' : 'нужно уточнить'}`,
    `Модель в сообщении: ${models.length ? models.join(', ') : 'нужно уточнить'}`,
    `Даты из сообщения: ${dateRange || 'нужно уточнить'}`,
    `Бюджет из сообщения: ${budget || 'нужно уточнить'}`,
    `Подача из сообщения: ${pickup || 'нужно уточнить'}`,
    'Распознанные данные требуют проверки менеджером.',
  ];
  return { phone: phones.length === 1 ? phones[0] : '', lines };
}
