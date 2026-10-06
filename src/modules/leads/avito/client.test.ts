import { describe, expect, it, vi } from 'vitest';
import { AvitoClient } from './client';

describe('Avito read-only client', () => {
  it('sends only the explicit text payload without marking the chat read', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'secret', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ id: 'out-1' }));
    const api = new AvitoClient('id', 'secret', request);
    await api.sendText('11', 'chat', 'Здравствуйте!');
    expect(request.mock.calls[1][0]).toBe(
      'https://api.avito.ru/messenger/v1/accounts/11/chats/chat/messages',
    );
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({
      type: 'text',
      message: { text: 'Здравствуйте!' },
    });
    expect(request.mock.calls[1][1]?.method).toBe('POST');
  });
  it('reads active item inventory through the official API', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'secret', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ resources: [] }));
    const api = new AvitoClient('id', 'secret', request);
    await api.activeItems();
    expect(request.mock.calls[1][0]).toBe(
      'https://api.avito.ru/core/v1/items?per_page=100&page=1&status=active',
    );
  });
  it('caches token and reads only messages/chat without marking read', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'secret', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ messages: [], meta: { has_more: false } }))
      .mockResolvedValueOnce(Response.json({ id: 'chat' }));
    const api = new AvitoClient('id', 'secret', request);
    await api.messages('11', 'chat', 0);
    await api.chat('11', 'chat');
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[1][0]).toBe(
      'https://api.avito.ru/messenger/v3/accounts/11/chats/chat/messages/?limit=100&offset=0',
    );
    expect(request.mock.calls[1][1]?.method).toBe('GET');
    expect(request.mock.calls.every(([, o]) => o?.redirect === 'error')).toBe(true);
  });
  it('stops subsequent requests until Retry-After has elapsed', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 's', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '300' } }));
    const api = new AvitoClient('id', 's', request, () => 1000000);
    await expect(api.chat('11', 'chat')).rejects.toMatchObject({ code: 'RATE', retryAt: 1300000 });
    await expect(api.chat('11', 'chat')).rejects.toMatchObject({ code: 'RATE' });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('stops on revoked access instead of retrying authentication', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 }));
    const api = new AvitoClient('id', 's', request);
    await expect(api.chat('11', 'chat')).rejects.toMatchObject({ code: 'ACCESS' });
    await expect(api.chat('11', 'chat')).rejects.toMatchObject({ code: 'ACCESS' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
