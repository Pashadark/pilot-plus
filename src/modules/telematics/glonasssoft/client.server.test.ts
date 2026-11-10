import { describe, expect, it, vi } from 'vitest';

import { GlonassSoftClient, GlonassSoftError } from './client.server';

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const options = (transport: (request: Request) => Promise<Response>) => ({
  baseUrl: 'https://gs.sputnik.vision/api/v3',
  username: 'provider-user',
  password: 'provider-password',
  transport,
  delay: vi.fn().mockResolvedValue(undefined),
  now: vi.fn().mockReturnValueOnce(0).mockReturnValue(500),
});

describe('GLONASSSoft API client', () => {
  it('authenticates on the exact host and uses X-Auth for vehicle lookup', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(json({ AuthId: 'session-token', ErrorStatus: 0 }))
      .mockResolvedValueOnce(json([{ vehicleId: 42, name: 'Volkswagen Polo А156АХ997' }]));
    const client = new GlonassSoftClient(options(transport));

    await expect(client.findVehicles()).resolves.toEqual([
      { externalId: '42', name: 'Volkswagen Polo А156АХ997' },
    ]);

    const login = transport.mock.calls[0]?.[0] as Request;
    const vehicles = transport.mock.calls[1]?.[0] as Request;
    expect(login.url).toBe('https://gs.sputnik.vision/api/v3/auth/login');
    expect(login.method).toBe('POST');
    expect(await login.json()).toEqual({ login: 'provider-user', password: 'provider-password' });
    expect(vehicles.url).toBe('https://gs.sputnik.vision/api/v3/vehicles/find');
    expect(vehicles.headers.get('x-auth')).toBe('session-token');
    expect(await vehicles.json()).toEqual({});
  });

  it('waits at least one second between every provider request including login', async () => {
    let currentTime = 0;
    const delay = vi.fn(async (milliseconds: number) => {
      currentTime += milliseconds;
    });
    const transport = vi
      .fn()
      .mockResolvedValueOnce(json('session-token'))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([]));
    const client = new GlonassSoftClient({
      ...options(transport),
      delay,
      now: () => currentTime,
    });

    await client.findVehicles();
    await client.findVehicles();

    expect(delay).toHaveBeenNthCalledWith(1, 1_000);
    expect(delay).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('shares one login between concurrent requests', async () => {
    let resolveLogin!: (response: Response) => void;
    const loginResponse = new Promise<Response>((resolve) => {
      resolveLogin = resolve;
    });
    const transport = vi
      .fn()
      .mockImplementationOnce(() => loginResponse)
      .mockImplementation(() => Promise.resolve(json([])));
    const client = new GlonassSoftClient(options(transport));

    const first = client.findVehicles();
    const second = client.findVehicles();
    resolveLogin(json({ token: 'shared-session' }));

    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
    const loginCalls = transport.mock.calls.filter(([request]) =>
      (request as Request).url.endsWith('/auth/login'),
    );
    expect(loginCalls).toHaveLength(1);
  });

  it.each([
    [400, 'INVALID_REQUEST'],
    [403, 'FORBIDDEN'],
    [429, 'RATE_LIMITED'],
  ] as const)('maps HTTP %s without reauthorization to %s', async (status, code) => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(json({ token: 'session' }))
      .mockResolvedValueOnce(json({}, status));
    const client = new GlonassSoftClient(options(transport));

    await expect(client.findVehicles()).rejects.toMatchObject({ code });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('treats a login 403 as forbidden instead of retrying credentials', async () => {
    const transport = vi.fn().mockResolvedValue(json({}, 403));
    const client = new GlonassSoftClient(options(transport));

    await expect(client.findVehicles()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('reauthenticates once after 401 and retries with the new session', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(json({ token: 'old-session' }))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ token: 'new-session' }))
      .mockResolvedValueOnce(json([]));
    const client = new GlonassSoftClient(options(transport));

    await expect(client.findVehicles()).resolves.toEqual([]);
    expect((transport.mock.calls[3]?.[0] as Request).headers.get('x-auth')).toBe('new-session');
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it('posts exact last-data and bounded range payloads', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(json('session'))
      .mockResolvedValueOnce(
        json([
          {
            vehicleId: 42,
            receiveTime: '2026-08-20T09:00:00Z',
            recordTime: '2026-08-20T08:59:30Z',
            state: 4,
            lat: 55.7558,
            lon: 37.6176,
            speed: 32,
            address: 'г. Москва, Зелёный проспект, д. 22',
          },
        ]),
      )
      .mockResolvedValueOnce(
        json({
          messages: [
            {
              deviceTime: '2026-08-20T08:59:45Z',
              serverTime: '2026-08-20T08:59:46.1234567Z',
              latitude: 55.7559,
              longitude: 37.6177,
              speed: 48,
              altitude: 150,
              satellites: 12,
              course: 90,
              voltage: 13.8,
              parameters: {},
              photoCount: 0,
              protocolType: 1,
            },
          ],
        }),
      );
    const client = new GlonassSoftClient(options(transport));

    await expect(client.getLastData(['42'])).resolves.toMatchObject([
      {
        externalId: '42',
        latitude: 55.7558,
        longitude: 37.6176,
        speedKph: 32,
        address: 'г. Москва, Зелёный проспект, д. 22',
      },
    ]);
    await expect(
      client.getTerminalMessages({
        externalId: '42',
        from: new Date('2026-08-20T00:00:00Z'),
        to: new Date('2026-08-21T00:00:00Z'),
      }),
    ).resolves.toEqual([
      {
        externalId: '2026-08-20T08:59:45Z',
        recordedAt: '2026-08-20T08:59:45Z',
        latitude: 55.7559,
        longitude: 37.6177,
        speedKph: 48,
        odometerKm: null,
      },
    ]);

    expect(await (transport.mock.calls[1]?.[0] as Request).json()).toEqual({ vehiclesIds: [42] });
    expect(await (transport.mock.calls[2]?.[0] as Request).json()).toEqual({
      vehicleId: 42,
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
    });
  });

  it('rejects unsafe base URLs before network access', () => {
    for (const baseUrl of [
      'http://gs.sputnik.vision/api/v3',
      'https://user:pass@gs.sputnik.vision/api/v3',
      'https://gs.sputnik.vision/api/v3?token=x',
      'https://gs.sputnik.vision/other',
    ]) {
      expect(() => new GlonassSoftClient({ ...options(vi.fn()), baseUrl })).toThrow(
        expect.objectContaining({ code: 'INVALID_CONFIGURATION' }),
      );
    }
  });

  it('rejects oversized and malformed responses without leaking credentials', async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response('{}', {
        headers: {
          'content-type': 'application/json',
          'content-length': String(2 * 1024 * 1024 + 1),
        },
      }),
    );
    const client = new GlonassSoftClient(options(transport));

    const error = await client.findVehicles().catch((caught: unknown) => caught);
    expect(error).toMatchObject<Partial<GlonassSoftError>>({ code: 'INVALID_RESPONSE' });
    expect(JSON.stringify(error)).not.toMatch(/provider-user|provider-password/u);
  });

  it('maps an aborted request to a safe timeout error', async () => {
    const transport = vi.fn(async (request: Request) => {
      await new Promise<void>((resolve) =>
        request.signal.addEventListener('abort', () => resolve()),
      );
      throw request.signal.reason;
    });
    const client = new GlonassSoftClient({ ...options(transport), timeoutMs: 5 });

    await expect(client.findVehicles()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('maps the provider HTTP 200 invalid-credentials envelope to AUTH_REJECTED', async () => {
    const transport = vi.fn().mockResolvedValue(
      json({
        Error: 'Неверное имя/пароль',
        ErrorStatus: 9,
        Notifications: [],
        User: '00000000',
      }),
    );
    const client = new GlonassSoftClient(options(transport));

    const error = await client.findVehicles().catch((caught: unknown) => caught);
    expect(error).toMatchObject<Partial<GlonassSoftError>>({ code: 'AUTH_REJECTED' });
    expect(JSON.stringify(error)).not.toMatch(/provider-user|provider-password/u);
  });
});
