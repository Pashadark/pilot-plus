import { expect, it, vi } from 'vitest';
import { verifyAvitoEvent } from './verify';
it('fetches authoritative text by exact ID and ignores spoofed callback content', async () => {
  const api = {
    chat: vi.fn().mockResolvedValue({
      id: 'chat',
      users: [
        { id: 11, name: 'Owner' },
        { id: 22, name: 'Anna' },
      ],
      context: {
        type: 'item',
        value: { id: 8252873021, title: 'Аренда Toyota Camry', user_id: 11 },
      },
    }),
    messages: vi.fn().mockResolvedValue({
      messages: [{ id: 'm1', author_id: 22, content: { text: 'Original' } }],
      meta: { has_more: false },
    }),
  };
  const result = await verifyAvitoEvent(api, { chatId: 'chat', messageId: 'm1' }, '11');
  expect(result.name).toBe('Anna');
  expect(result.chat).toMatchObject({ context: { value: { id: 8252873021, user_id: 11 } } });
  expect(result.message).toMatchObject({ content: { text: 'Original' } });
});
it('does not accept another chat or absent message', async () => {
  const api = { chat: async () => ({ id: 'another', users: [{ id: 11 }] }), messages: vi.fn() };
  await expect(verifyAvitoEvent(api, { chatId: 'chat', messageId: 'm1' }, '11')).rejects.toThrow(
    'AVITO_CHAT',
  );
  expect(api.messages).not.toHaveBeenCalled();
});
it('does not import other messages while paging for a single event', async () => {
  const api = {
    chat: async () => ({ id: 'chat', users: [{ id: 11 }, { id: 22 }] }),
    messages: vi
      .fn()
      .mockResolvedValueOnce({ messages: [{ id: 'old' }], meta: { has_more: true } })
      .mockResolvedValueOnce({
        messages: [{ id: 'target', author_id: 22 }],
        meta: { has_more: false },
      }),
  };
  const result = await verifyAvitoEvent(api, { chatId: 'chat', messageId: 'target' }, '11');
  expect(result.message).toMatchObject({ id: 'target' });
  expect(api.messages).toHaveBeenLastCalledWith('11', 'chat', 100);
});
