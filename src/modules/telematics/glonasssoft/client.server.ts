import 'server-only';

import type { z } from 'zod';

import {
  authResponseSchema,
  lastDataListSchema,
  mileageSchema,
  terminalMessagesSchema,
  vehiclesSchema,
} from './schemas';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MIN_REQUEST_INTERVAL_MS = 500;
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

type Transport = (request: Request) => Promise<Response>;

export type GlonassSoftErrorCode =
  'INVALID_CONFIGURATION' | 'AUTH_REJECTED' | 'TIMEOUT' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

export class GlonassSoftError extends Error {
  constructor(public readonly code: GlonassSoftErrorCode) {
    super('Не удалось получить данные GLONASSSoft.');
    this.name = 'GlonassSoftError';
  }
}

export interface GlonassSoftRange {
  externalId: string;
  from: Date;
  to: Date;
}

export interface GlonassSoftClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  transport?: Transport;
  timeoutMs?: number;
  now?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
}

function validateBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (
      (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && loopback)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/$/u, '') !== '/api/v3'
    ) {
      throw new GlonassSoftError('INVALID_CONFIGURATION');
    }
    return url.toString().replace(/\/$/u, '');
  } catch (error) {
    if (error instanceof GlonassSoftError) throw error;
    throw new GlonassSoftError('INVALID_CONFIGURATION');
  }
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new GlonassSoftError('INVALID_RESPONSE');
  }
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength &&
    (!/^\d+$/u.test(declaredLength) || BigInt(declaredLength) > BigInt(MAX_RESPONSE_BYTES))
  ) {
    throw new GlonassSoftError('INVALID_RESPONSE');
  }
  if (!response.body) throw new GlonassSoftError('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new GlonassSoftError('INVALID_RESPONSE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new GlonassSoftError('INVALID_RESPONSE');
  }
}

export class GlonassSoftClient {
  private readonly baseUrl: string;
  private readonly transport: Transport;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly delay: (milliseconds: number) => Promise<void>;
  private session: string | null = null;
  private lastApiRequestAt: number | null = null;

  constructor(private readonly options: GlonassSoftClientOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl);
    if (!options.username.trim() || !options.password) {
      throw new GlonassSoftError('INVALID_CONFIGURATION');
    }
    this.transport = options.transport ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.now = options.now ?? Date.now;
    this.delay =
      options.delay ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async findVehicles() {
    return this.authenticated('/vehicles/find', {}, vehiclesSchema);
  }

  async getLastData(externalIds: readonly string[]) {
    const ids = externalIds.map(parseExternalId);
    if (ids.length === 0 || ids.length > 10_000 || new Set(ids).size !== ids.length) {
      throw new GlonassSoftError('INVALID_RESPONSE');
    }
    return this.authenticated('/vehicles/getlastdata', ids, lastDataListSchema);
  }

  async getTerminalMessages(range: GlonassSoftRange) {
    const body = rangeBody(range);
    return this.authenticated('/terminalMessages', body, terminalMessagesSchema);
  }

  async getMileageAndMotohours(range: GlonassSoftRange) {
    const body = rangeBody(range);
    return this.authenticated(
      '/vehicles/mileageAndMotohours',
      { sampling: 86_400, vehicleIds: [body.vehicleId], from: body.from, to: body.to, timezone: 3 },
      mileageSchema,
    );
  }

  private async authenticated<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    if (!this.session) this.session = await this.login();
    let response = await this.post(path, body, this.session, true);
    if (response.status === 401) {
      this.session = await this.login();
      response = await this.post(path, body, this.session, true);
    }
    if (response.status === 401) throw new GlonassSoftError('AUTH_REJECTED');
    if (!response.ok) throw new GlonassSoftError('UNAVAILABLE');
    const parsed = schema.safeParse(await boundedJson(response));
    if (!parsed.success) throw new GlonassSoftError('INVALID_RESPONSE');
    return parsed.data;
  }

  private async login(): Promise<string> {
    const response = await this.post(
      '/auth/login',
      { login: this.options.username, password: this.options.password },
      null,
      false,
    );
    if (response.status === 401 || response.status === 403) {
      throw new GlonassSoftError('AUTH_REJECTED');
    }
    if (!response.ok) throw new GlonassSoftError('UNAVAILABLE');
    const parsed = authResponseSchema.safeParse(await boundedJson(response));
    if (!parsed.success) throw new GlonassSoftError('INVALID_RESPONSE');
    return parsed.data;
  }

  private async post(
    path: string,
    body: unknown,
    session: string | null,
    rateLimited: boolean,
  ): Promise<Response> {
    if (rateLimited) await this.waitForRateLimit();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const request = new Request(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(session ? { 'X-Auth': session } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return await this.transport(request);
    } catch (error) {
      if (error instanceof GlonassSoftError) throw error;
      if (controller.signal.aborted) throw new GlonassSoftError('TIMEOUT');
      throw new GlonassSoftError('UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const current = this.now();
    if (this.lastApiRequestAt !== null) {
      const wait = MIN_REQUEST_INTERVAL_MS - (current - this.lastApiRequestAt);
      if (wait > 0) await this.delay(wait);
    }
    this.lastApiRequestAt = current;
  }
}

function parseExternalId(value: string): number {
  if (!/^\d+$/u.test(value)) throw new GlonassSoftError('INVALID_RESPONSE');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new GlonassSoftError('INVALID_RESPONSE');
  return parsed;
}

function rangeBody(range: GlonassSoftRange) {
  const vehicleId = parseExternalId(range.externalId);
  const from = range.from.getTime();
  const to = range.to.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > MAX_RANGE_MS) {
    throw new GlonassSoftError('INVALID_RESPONSE');
  }
  return { vehicleId, from: range.from.toISOString(), to: range.to.toISOString() };
}
