import 'server-only';

import type { z } from 'zod';

import { driverHelperCarsPageSchema, driverHelperFinesPageSchema } from './schemas';

const BASE_URL = 'https://api.driver-helper.ru';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export type DriverHelperErrorCode =
  'AUTH_REJECTED' | 'SERVICE_PAYMENT_REQUIRED' | 'TIMEOUT' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

export class DriverHelperError extends Error {
  constructor(public readonly code: DriverHelperErrorCode) {
    super('Не удалось получить данные Driver Helper.');
    this.name = 'DriverHelperError';
  }
}

type Transport = (request: Request) => Promise<Response>;

interface DriverHelperClientOptions {
  token: string;
  transport?: Transport;
  timeoutMs?: number;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new DriverHelperError('INVALID_RESPONSE');
  }
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_RESPONSE_BYTES) throw new DriverHelperError('INVALID_RESPONSE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new DriverHelperError('INVALID_RESPONSE');
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DriverHelperError('INVALID_RESPONSE');
  }
}

function httpError(status: number): DriverHelperError {
  if (status === 401) return new DriverHelperError('AUTH_REJECTED');
  if (status === 402) return new DriverHelperError('SERVICE_PAYMENT_REQUIRED');
  return new DriverHelperError('UNAVAILABLE');
}

export class DriverHelperClient {
  private readonly transport: Transport;
  private readonly timeoutMs: number;

  constructor(private readonly options: DriverHelperClientOptions) {
    if (!options.token.trim()) throw new DriverHelperError('AUTH_REJECTED');
    this.transport = options.transport ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const request = new Request(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${this.options.token}` },
        signal: controller.signal,
      });
      const response = await this.transport(request);
      if (!response.ok) throw httpError(response.status);
      const parsed = schema.safeParse(await boundedJson(response));
      if (!parsed.success) throw new DriverHelperError('INVALID_RESPONSE');
      return parsed.data;
    } catch (error) {
      if (error instanceof DriverHelperError) throw error;
      if (controller.signal.aborted) throw new DriverHelperError('TIMEOUT');
      throw new DriverHelperError('UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }

  listCars(page: number) {
    if (!Number.isInteger(page) || page < 1) throw new DriverHelperError('INVALID_RESPONSE');
    return this.get(`/v1.0/cars?page=${page}&perPage=50`, driverHelperCarsPageSchema);
  }

  listUnpaidFines(page: number) {
    if (!Number.isInteger(page) || page < 1) throw new DriverHelperError('INVALID_RESPONSE');
    return this.get(`/v1.0/fines?page=${page}&perPage=50`, driverHelperFinesPageSchema);
  }
}
