// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useVehicleTrackHistory } from './useVehicleTrackHistory';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const emptyHistory = {
  vehicleId: 'vehicle-1',
  from: '2026-09-15',
  to: '2026-09-15',
  availableDates: [],
  tracks: [],
  fines: [],
};

it('обновляет открытый маршрут и прекращает обновления после закрытия', async () => {
  vi.useFakeTimers();
  const updated = { ...emptyHistory, availableDates: ['2026-09-15'] };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => emptyHistory })
    .mockResolvedValue({ ok: true, json: async () => updated });
  vi.stubGlobal('fetch', fetchMock);
  const { result, unmount } = renderHook(() =>
    useVehicleTrackHistory({
      vehicleId: 'vehicle-1',
      from: '2026-09-15',
      to: '2026-09-15',
    }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.data).toEqual(emptyHistory);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(result.current.data).toEqual(updated);
  expect(result.current.loading).toBe(false);
  unmount();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('не делает запрос без выбранной машины', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() =>
    useVehicleTrackHistory({ vehicleId: null, from: '2026-09-15', to: '2026-09-15' }),
  );

  expect(fetchMock).not.toHaveBeenCalled();
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(false);
});

it('не опрашивает историю при выключенном обновлении', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => emptyHistory });
  vi.stubGlobal('fetch', fetchMock);
  renderHook(() => useVehicleTrackHistory({
    vehicleId: 'vehicle-1', from: '2026-09-15', to: '2026-09-15', refreshIntervalMs: 0,
  }));
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('кодирует параметры, загружает историю и повторяет текущий запрос', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => emptyHistory,
  });
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() =>
    useVehicleTrackHistory({ vehicleId: 'vehicle/1', from: '2026-09-15', to: '2026-09-15' }),
  );

  await waitFor(() => expect(result.current.data).toEqual(emptyHistory));
  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    '/api/map/tracks?vehicleId=vehicle%2F1&from=2026-09-15&to=2026-09-15',
  );

  act(() => result.current.retry());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});

it('отменяет предыдущий запрос при смене машины и игнорирует устаревший ответ', async () => {
  let resolveFirst!: (value: unknown) => void;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const secondHistory = { ...emptyHistory, vehicleId: 'vehicle-2' };
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValueOnce({ ok: true, json: async () => secondHistory });
  vi.stubGlobal('fetch', fetchMock);

  const { result, rerender } = renderHook(
    ({ vehicleId }) => useVehicleTrackHistory({ vehicleId, from: '2026-09-15', to: '2026-09-15' }),
    { initialProps: { vehicleId: 'vehicle-1' } },
  );

  rerender({ vehicleId: 'vehicle-2' });
  await waitFor(() => expect(result.current.data).toEqual(secondHistory));
  expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  expect(((fetchMock.mock.calls[0]?.[1] as RequestInit).signal as AbortSignal).aborted).toBe(true);

  resolveFirst({ ok: true, json: async () => emptyHistory });
  await act(async () => Promise.resolve());
  expect(result.current.data).toEqual(secondHistory);
});

it('показывает понятную ошибку и сохраняет последние успешные данные при повторе', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => emptyHistory })
    .mockResolvedValueOnce({ ok: false, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() =>
    useVehicleTrackHistory({ vehicleId: 'vehicle-1', from: '2026-09-15', to: '2026-09-15' }),
  );

  await waitFor(() => expect(result.current.data).toEqual(emptyHistory));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.error).toBe('Не удалось загрузить маршрут.'));
  expect(result.current.data).toEqual(emptyHistory);
});
