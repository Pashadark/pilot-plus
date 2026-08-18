import 'server-only';

import type { z } from 'zod';

import {
  driverHelperCarsPageSchema,
  driverHelperFinePhotosSchema,
  driverHelperFinesPageSchema,
  driverHelperInvoiceCheckSchema,
  driverHelperInvoiceCreateSchema,
  driverHelperMoneyToMinor,
} from './schemas';
import { validateDriverHelperPaymentUrl } from './payment-url';

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

export interface CreateSandboxInvoiceInput {
  ids: string[];
  successUrl: string;
  failUrl: string;
  sandbox?: true;
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

  private async request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const request = new Request(`${BASE_URL}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.options.token}`, ...init.headers },
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

  private get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    return this.request(path, {}, schema);
  }

  private postForm<T>(path: string, form: URLSearchParams, schema: z.ZodType<T>): Promise<T> {
    return this.request(path, { method: 'POST', body: form }, schema);
  }

  listCars(page: number) {
    if (!Number.isInteger(page) || page < 1) throw new DriverHelperError('INVALID_RESPONSE');
    return this.get(`/v1.0/cars?page=${page}&perPage=50`, driverHelperCarsPageSchema);
  }

  listUnpaidFines(page: number) {
    if (!Number.isInteger(page) || page < 1) throw new DriverHelperError('INVALID_RESPONSE');
    return this.get(`/v1.0/fines?page=${page}&perPage=50`, driverHelperFinesPageSchema);
  }

  getFinePhotos(fineId: string) {
    if (!/^\d+$/u.test(fineId)) throw new DriverHelperError('INVALID_RESPONSE');
    return this.get(`/v1.0/fine/${fineId}/photo/base64`, driverHelperFinePhotosSchema);
  }

  async checkInvoice(ids: string[]) {
    const form = this.invoiceIdsForm(ids);
    const invoice = await this.postForm(
      '/v1.0/invoice/check',
      form,
      driverHelperInvoiceCheckSchema,
    );
    return {
      fineAmountMinor: driverHelperMoneyToMinor(invoice.fineAmount),
      commissionAmountMinor: driverHelperMoneyToMinor(invoice.commissionAmount),
      totalAmountMinor: driverHelperMoneyToMinor(invoice.totalAmount),
    };
  }

  async createSandboxInvoice(input: CreateSandboxInvoiceInput) {
    if (Object.hasOwn(input, 'sandbox') && input.sandbox !== true) {
      throw new DriverHelperError('INVALID_RESPONSE');
    }
    if (!this.isTrustedCallbackUrl(input.successUrl) || !this.isTrustedCallbackUrl(input.failUrl)) {
      throw new DriverHelperError('INVALID_RESPONSE');
    }
    const form = this.invoiceIdsForm(input.ids);
    form.set('success_url', input.successUrl);
    form.set('fail_url', input.failUrl);
    form.set('sandbox', '1');
    const invoice = await this.postForm('/v1.0/invoice', form, driverHelperInvoiceCreateSchema);
    const payment = validateDriverHelperPaymentUrl(invoice.paymentUrl);
    if (!payment) throw new DriverHelperError('INVALID_RESPONSE');
    return {
      providerInvoiceId: invoice.providerInvoiceId,
      ...payment,
      fineAmountMinor: driverHelperMoneyToMinor(invoice.fineAmount),
      commissionAmountMinor: driverHelperMoneyToMinor(invoice.commissionAmount),
      totalAmountMinor: driverHelperMoneyToMinor(invoice.totalAmount),
    };
  }

  private invoiceIdsForm(ids: string[]): URLSearchParams {
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.some((id) => typeof id !== 'string' || !/^\d+$/u.test(id)) ||
      new Set(ids).size !== ids.length
    ) {
      throw new DriverHelperError('INVALID_RESPONSE');
    }
    const form = new URLSearchParams();
    for (const id of ids) form.append('fines[]', id);
    return form;
  }

  private isTrustedCallbackUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  }
}
