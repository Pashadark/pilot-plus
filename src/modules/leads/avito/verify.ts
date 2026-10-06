import { record } from './message';
type Reader = {
  chat: (account: string, chat: string) => Promise<unknown>;
  messages: (account: string, chat: string, offset: number) => Promise<unknown>;
};
export async function verifyAvitoEvent(
  api: Reader,
  event: { chatId: string; messageId: string },
  account: string,
) {
  const chat = record(await api.chat(account, event.chatId));
  if (
    chat.id !== event.chatId ||
    !Array.isArray(chat.users) ||
    !chat.users.some((u) => String(record(u).id) === account)
  )
    throw Error('AVITO_CHAT');
  const title = record(record(chat.context).value).title;
  for (let offset = 0; offset <= 1000; offset += 100) {
    const page = record(await api.messages(account, event.chatId, offset));
    if (!Array.isArray(page.messages)) throw Error('AVITO_FORMAT');
    const message = page.messages.find((m) => record(m).id === event.messageId);
    if (message) {
      const author = chat.users
        .map(record)
        .find((u) => String(u.id) === String(record(message).author_id));
      return {
        chat,
        message,
        name: typeof author?.name === 'string' ? author.name : 'Клиент Авито',
        title: typeof title === 'string' ? title : '',
        chatVerified: true,
      };
    }
    if (record(page.meta).has_more !== true) break;
  }
  throw Error('AVITO_MESSAGE_NOT_FOUND');
}
