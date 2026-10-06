import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUser = vi.hoisted(() => vi.fn());
const getOnlineMapTrackHistory = vi.hoisted(() => vi.fn());

vi.mock('@/modules/auth/dal', () => ({ getCurrentUser }));
vi.mock('@/modules/online-map/server/track-history', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/online-map/server/track-history')
  >();
  return { ...actual, getOnlineMapTrackHistory };
});

import { TrackHistoryError } from '@/modules/online-map/server/track-history';

import { GET } from './route';

describe('GET /api/map/tracks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('возвращает 401 без сессии', async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/map/tracks'));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('возвращает приватную историю маршрута', async () => {
    const user = { id: 'root', role: 'SUPER_ADMIN' };
    getCurrentUser.mockResolvedValue(user);
    getOnlineMapTrackHistory.mockResolvedValue({
      vehicleId: 'vehicle-1',
      from: '2026-09-15',
      to: '2026-09-15',
      availableDates: [],
      tracks: [],
      fines: [],
    });

    const response = await GET(
      new Request(
        'http://localhost/api/map/tracks?vehicleId=vehicle-1&from=2026-09-15&to=2026-09-15',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(getOnlineMapTrackHistory).toHaveBeenCalledWith(user, {
      vehicleId: 'vehicle-1',
      from: '2026-09-15',
      to: '2026-09-15',
    });
    expect(await response.json()).toEqual(expect.objectContaining({ vehicleId: 'vehicle-1' }));
  });

  it.each([
    [new TrackHistoryError('INVALID_INPUT', 'bad input'), 400],
    [new TrackHistoryError('INVALID_RANGE', 'bad range'), 400],
    [new TrackHistoryError('FORBIDDEN', 'forbidden'), 403],
  ])('преобразует доменную ошибку в HTTP', async (error, status) => {
    getCurrentUser.mockResolvedValue({ id: 'root', role: 'SUPER_ADMIN' });
    getOnlineMapTrackHistory.mockRejectedValue(error);

    const response = await GET(
      new Request(
        'http://localhost/api/map/tracks?vehicleId=vehicle-1&from=2026-09-15&to=2026-09-15',
      ),
    );

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
