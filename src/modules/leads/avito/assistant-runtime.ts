import { record } from './message';
import { approvedRentalIds } from './rental-request';

export function activeRentalIds(value: unknown) {
  const items = record(value).resources;
  if (!Array.isArray(items)) throw Error('AVITO_FORMAT');
  return new Set(
    items
      .map(record)
      .filter(
        (item) =>
          approvedRentalIds.has(String(item.id)) &&
          String(record(item.category).id) === '114' &&
          typeof item.title === 'string' &&
          /^Аренда\s/iu.test(item.title),
      )
      .map((item) => String(item.id)),
  );
}

export async function readHumanReplies(
  api: { messages: (account: string, chat: string, offset: number) => Promise<unknown> },
  account: string,
  chat: string,
  since: Date,
  ownIds: ReadonlySet<string>,
) {
  const replies: Record<string, unknown>[] = [];
  for (let offset = 0; offset <= 1000; offset += 100) {
    const page = record(await api.messages(account, chat, offset));
    if (!Array.isArray(page.messages) || typeof record(page.meta).has_more !== 'boolean')
      throw Error('AVITO_FORMAT');
    for (const raw of page.messages) {
      const m = record(raw);
      if (typeof m.created !== 'number' || !Number.isFinite(m.created)) throw Error('AVITO_FORMAT');
      if (m.created * 1000 < since.getTime() || m.type === 'system') continue;
      if (
        m.direction === 'out' &&
        String(m.author_id) === account &&
        typeof m.id === 'string' &&
        !ownIds.has(m.id)
      )
        replies.push(m);
    }
    if (record(page.meta).has_more === false) return replies;
    // Do not assume undocumented paging order. Full bounded scan or fail closed.
  }
  throw Error('AVITO_HISTORY_LIMIT');
}
