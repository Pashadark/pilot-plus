export class AvitoError extends Error {
  constructor(
    public code: 'RATE' | 'ACCESS' | 'HTTP' | 'FORMAT',
    public retryAt = 0,
  ) {
    super('AVITO_' + code);
  }
}
export class AvitoClient {
  private token = '';
  private expiresAt = 0;
  private blockedUntil = 0;
  private stopped = false;
  constructor(
    private clientId: string,
    private secret: string,
    private request: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}
  private async call(path: string, options: RequestInit) {
    if (this.stopped) throw new AvitoError('ACCESS');
    if (this.now() < this.blockedUntil) throw new AvitoError('RATE', this.blockedUntil);
    const response = await this.request('https://api.avito.ru' + path, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429) {
      const retry = response.headers.get('Retry-After');
      const seconds =
        retry && /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : retry
            ? Date.parse(retry) - this.now()
            : 60000;
      this.blockedUntil = this.now() + Math.max(60000, Number.isFinite(seconds) ? seconds : 60000);
      throw new AvitoError('RATE', this.blockedUntil);
    }
    if ([400, 401, 402, 403].includes(response.status)) {
      this.stopped = true;
      throw new AvitoError('ACCESS');
    }
    if (!response.ok) throw new AvitoError('HTTP');
    return response.json() as Promise<unknown>;
  }
  private async authorized(path: string, options: RequestInit) {
    if (!this.token || this.expiresAt <= this.now()) {
      const value = await this.call('/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.secret,
        }),
      });
      const result = value as { access_token?: unknown; expires_in?: unknown };
      if (typeof result?.access_token !== 'string' || typeof result.expires_in !== 'number')
        throw new AvitoError('FORMAT');
      this.token = result.access_token;
      this.expiresAt = this.now() + Math.max(0, result.expires_in - 60) * 1000;
    }
    return this.call(path, {
      ...options,
      headers: { ...options.headers, Authorization: 'Bearer ' + this.token },
    });
  }
  private get(path: string) {
    return this.authorized(path, { method: 'GET' });
  }
  sendText(accountId: string, chatId: string, text: string) {
    if (!text.trim() || text.length > 1000) throw new AvitoError('FORMAT');
    return this.authorized(
      `/messenger/v1/accounts/${encodeURIComponent(accountId)}/chats/${encodeURIComponent(chatId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', message: { text } }),
      },
    );
  }
  chat(accountId: string, chatId: string) {
    return this.get(
      `/messenger/v2/accounts/${encodeURIComponent(accountId)}/chats/${encodeURIComponent(chatId)}`,
    );
  }
  activeItems() {
    // First page is sufficient for the approved 11-item allowlist. Missing items fail closed.
    return this.get('/core/v1/items?per_page=100&page=1&status=active');
  }
  messages(accountId: string, chatId: string, offset: number) {
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000) throw new AvitoError('FORMAT');
    return this.get(
      `/messenger/v3/accounts/${encodeURIComponent(accountId)}/chats/${encodeURIComponent(chatId)}/messages/?limit=100&offset=${offset}`,
    );
  }
}
