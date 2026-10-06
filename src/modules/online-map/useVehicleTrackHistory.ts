'use client';

import { useCallback, useEffect, useState } from 'react';

import type { OnlineMapTrackHistoryDto } from './track-types';

export interface UseVehicleTrackHistoryInput {
  vehicleId: string | null;
  from: string;
  to: string;
  refreshIntervalMs?: number;
}

export interface UseVehicleTrackHistoryResult {
  data: OnlineMapTrackHistoryDto | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useVehicleTrackHistory({
  vehicleId,
  from,
  to,
  refreshIntervalMs = 30_000,
}: UseVehicleTrackHistoryInput): UseVehicleTrackHistoryResult {
  const [data, setData] = useState<OnlineMapTrackHistoryDto | null>(null);
  const [dataRequestKey, setDataRequestKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!vehicleId) return;

    const controller = new AbortController();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const query = new URLSearchParams({ vehicleId, from, to });
    const requestKey = `${vehicleId}:${from}:${to}`;

    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });

    const refresh = () => {
      void fetch(`/api/map/tracks?${query.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'same-origin',
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('TRACK_HISTORY_REQUEST_FAILED');
          return (await response.json()) as OnlineMapTrackHistoryDto;
        })
        .then((nextData) => {
          if (!active) return;
          setData(nextData);
          setDataRequestKey(requestKey);
          setLoading(false);
          setError(null);
        })
        .catch(() => {
          if (!active || controller.signal.aborted) return;
          setLoading(false);
          setError('Не удалось загрузить маршрут.');
        })
        .finally(() => {
          if (active && refreshIntervalMs > 0) timer = setTimeout(refresh, refreshIntervalMs);
        });
    };
    refresh();

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, from, to, vehicleId, refreshIntervalMs]);

  if (!vehicleId) return { data: null, loading: false, error: null, retry };
  const requestKey = `${vehicleId}:${from}:${to}`;
  return {
    data: dataRequestKey === requestKey ? data : null,
    loading,
    error,
    retry,
  };
}
