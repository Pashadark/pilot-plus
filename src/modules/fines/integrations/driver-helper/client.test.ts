import { describe, expect, it, vi } from 'vitest';

import { DriverHelperClient, DriverHelperError } from './client';

const response = (body: unknown, status = 200, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });

describe('Driver Helper API client', () => {
  it('checks invoices with the exact form-encoded fine IDs', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        response({ amount_fines: '100.01', amount_commission: '8.50', amount_total: '108.51' }),
      );
    const client = new DriverHelperClient({ token: 'secret-token', transport });

    await expect(client.checkInvoice(['17', '29'])).resolves.toEqual({
      fineAmountMinor: '10001',
      commissionAmountMinor: '850',
      totalAmountMinor: '10851',
    });
    const request = transport.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('https://api.driver-helper.ru/v1.0/invoice/check');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded;charset=UTF-8',
    );
    await expect(request.text()).resolves.toBe('fines%5B%5D=17&fines%5B%5D=29');
  });

  it('creates a sandbox invoice with trusted callbacks and a vetted payment URL', async () => {
    const transport = vi.fn().mockResolvedValue(
      response({
        invoice_id: 'invoice-17',
        pay_url: 'https://pay.driver-helper.ru/invoices/invoice-17',
        amount_fines: '100.01',
        amount_commission: '8.50',
        amount_total: '108.51',
      }),
    );
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport,
      paymentCallbacks: {
        successUrl: 'https://pilot.example.test/fines/payment/success',
        failUrl: 'https://pilot.example.test/fines/payment/fail',
      },
    });

    await expect(
      client.createSandboxInvoice({
        ids: ['17', '29'],
      }),
    ).resolves.toEqual({
      providerInvoiceId: 'invoice-17',
      paymentUrl: 'https://pay.driver-helper.ru/invoices/invoice-17',
      paymentHost: 'pay.driver-helper.ru',
      fineAmountMinor: '10001',
      commissionAmountMinor: '850',
      totalAmountMinor: '10851',
    });
    const request = transport.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('https://api.driver-helper.ru/v1.0/invoice');
    expect(request.method).toBe('POST');
    await expect(request.text()).resolves.toBe(
      'fines%5B%5D=17&fines%5B%5D=29&success_url=https%3A%2F%2Fpilot.example.test%2Ffines%2Fpayment%2Fsuccess&fail_url=https%3A%2F%2Fpilot.example.test%2Ffines%2Fpayment%2Ffail&sandbox=1',
    );
  });

  it('appends only server-supplied signed state to trusted callback URLs', async () => {
    const transport = vi.fn().mockResolvedValue(
      response({
        invoice_id: 'invoice-17',
        pay_url: 'https://pay.driver-helper.ru/invoices/invoice-17',
        amount_fines: '100.00',
        amount_commission: '8.00',
        amount_total: '108.00',
      }),
    );
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport,
      paymentCallbacks: {
        successUrl: 'https://pilot.example.test/fines/payment/success',
        failUrl: 'https://pilot.example.test/fines/payment/fail',
        successState: 'signed-success.state',
        failState: 'signed-fail.state',
      },
    });

    await client.createSandboxInvoice({ ids: ['17'] });

    const request = transport.mock.calls[0]?.[0] as Request;
    const body = new URLSearchParams(await request.text());
    expect(body.get('success_url')).toBe(
      'https://pilot.example.test/fines/payment/success?state=signed-success.state',
    );
    expect(body.get('fail_url')).toBe(
      'https://pilot.example.test/fines/payment/fail?state=signed-fail.state',
    );
  });

  it('uses only constructor-configured callback URLs when untyped caller input includes an attacker URL', async () => {
    const transport = vi.fn().mockResolvedValue(
      response({
        invoice_id: 'invoice-17',
        pay_url: 'https://pay.driver-helper.ru/invoices/invoice-17',
        amount_fines: '100.01',
        amount_commission: '8.50',
        amount_total: '108.51',
      }),
    );
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport,
      paymentCallbacks: {
        successUrl: 'https://pilot.example.test/fines/payment/success',
        failUrl: 'https://pilot.example.test/fines/payment/fail',
      },
    });

    await client.createSandboxInvoice({
      ids: ['17'],
      successUrl: 'https://attacker.example.test/collect',
      failUrl: 'https://attacker.example.test/collect',
    } as never);

    const request = transport.mock.calls[0]?.[0] as Request;
    const body = await request.text();
    expect(body).toContain(
      'success_url=https%3A%2F%2Fpilot.example.test%2Ffines%2Fpayment%2Fsuccess',
    );
    expect(body).not.toContain('attacker.example.test');
  });

  it.each([
    'http://pilot.example.test/fines/payment/success',
    'https://user:password@pilot.example.test/fines/payment/success',
    'https://pilot.example.test:444/fines/payment/success',
    'https://pilot.example.test/fines/payment/success?state=secret',
    'https://pilot.example.test/fines/payment/success#fragment',
  ])('rejects unsafe configured callback URL %s before any request', (successUrl) => {
    expect(
      () =>
        new DriverHelperClient({
          token: 'secret-token',
          paymentCallbacks: {
            successUrl,
            failUrl: 'https://pilot.example.test/fines/payment/fail',
          },
        }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it.each([
    [401, 'AUTH_REJECTED'],
    [402, 'SERVICE_PAYMENT_REQUIRED'],
  ] as const)('maps invoice HTTP %s to safe code %s', async (status, code) => {
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport: vi.fn().mockResolvedValue(response({ pay_url: 'must-not-leak' }, status)),
    });

    await expect(client.checkInvoice(['17'])).rejects.toMatchObject({ code });
  });

  it('rejects invoice responses that exceed the response cap', async () => {
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport: vi.fn().mockResolvedValue(
        new Response('{}', {
          headers: {
            'content-type': 'application/json',
            'content-length': String(2 * 1024 * 1024 + 1),
          },
        }),
      ),
    });

    await expect(client.checkInvoice(['17'])).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('cancels a chunked response that exceeds the cap without a content-length header', async () => {
    const cancel = vi.fn();
    const megabyte = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(megabyte);
        controller.enqueue(megabyte);
        controller.enqueue(new Uint8Array([123]));
      },
      cancel,
    });
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport: vi
        .fn()
        .mockResolvedValue(new Response(body, { headers: { 'content-type': 'application/json' } })),
    });

    await expect(client.checkInvoice(['17'])).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    ['12.345', 'malformed fractional money'],
    ['1000000000000000.00', 'excessive money'],
    [100.01, 'unsafe numeric money'],
  ])('rejects %s in invoice response', async (amount, _description) => {
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport: vi
        .fn()
        .mockResolvedValue(
          response({ amount_fines: '100.00', amount_commission: '0.00', amount_total: amount }),
        ),
    });

    await expect(client.checkInvoice(['17'])).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('rejects empty or duplicate fine IDs and never accepts sandbox false', async () => {
    const transport = vi.fn();
    const client = new DriverHelperClient({ token: 'secret-token', transport });

    await expect(client.checkInvoice([])).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(client.checkInvoice(['17', '17'])).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    await expect(
      client.createSandboxInvoice({
        ids: ['17'],
        sandbox: false as never,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('loads a bounded cars page with bearer authorization', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        response({ totalCount: 1, current: 1, last: 1, items: [{ id: 7, title: 'Polo' }] }),
      );
    const client = new DriverHelperClient({ token: 'secret-token', transport });

    await expect(client.listCars(1)).resolves.toMatchObject({ totalCount: 1, current: 1 });
    const request = transport.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('https://api.driver-helper.ru/v1.0/cars?page=1&perPage=50');
    expect(request.headers.get('authorization')).toBe('Bearer secret-token');
  });

  it('loads paid fines from the provider paid endpoint and normalizes paid amount fields', async () => {
    const transport = vi.fn().mockResolvedValue(
      response({
        totalCount: 1,
        current: 1,
        last: 1,
        items: [
          {
            id: 91,
            post_mum: '0355431079217869900814347',
            fine_date: '2026-08-13 09:51:00',
            amount: '19',
            total_suma: '19',
          },
        ],
      }),
    );
    const client = new DriverHelperClient({ token: 'secret-token', transport });

    await expect(client.listPaidFines(1)).resolves.toMatchObject({
      items: [{ id: 91, suma: '19', paid: true }],
    });
    const request = transport.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('https://api.driver-helper.ru/v1.0/fines/paid?page=1&perPage=50');
  });

  it.each([
    [401, 'AUTH_REJECTED'],
    [402, 'SERVICE_PAYMENT_REQUIRED'],
    [503, 'UNAVAILABLE'],
  ] as const)('maps HTTP %s to safe code %s', async (status, code) => {
    const client = new DriverHelperClient({
      token: 'secret-token',
      transport: vi.fn().mockResolvedValue(response({ token: 'must-not-leak' }, status)),
    });

    await expect(client.listUnpaidFines(1)).rejects.toMatchObject({ code });
    await expect(client.listUnpaidFines(1)).rejects.not.toThrow(/secret-token|must-not-leak/);
  });

  it('rejects non-json and invalid payloads', async () => {
    const html = new Response('<html>error</html>', {
      headers: { 'content-type': 'text/html' },
    });
    const client = new DriverHelperClient({
      token: 'secret',
      transport: vi.fn().mockResolvedValue(html),
    });
    await expect(client.listCars(1)).rejects.toEqual(
      expect.objectContaining<Partial<DriverHelperError>>({ code: 'INVALID_RESPONSE' }),
    );
  });

  it('loads fine photo metadata without exposing the token', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        response({ status: 'photo_exists', photos: ['data:image/jpeg;base64,AA=='] }),
      );
    const client = new DriverHelperClient({ token: 'secret-token', transport });

    await expect(client.getFinePhotos('91')).resolves.toEqual({
      status: 'photo_exists',
      photos: ['data:image/jpeg;base64,AA=='],
    });
    const request = transport.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('https://api.driver-helper.ru/v1.0/fine/91/photo/base64');
  });
});
