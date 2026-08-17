import { describe, expect, it, vi } from 'vitest';

import { DriverHelperClient, DriverHelperError } from './client';

const response = (body: unknown, status = 200, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });

describe('Driver Helper API client', () => {
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
