'use client';

import { useEffect, useState } from 'react';

import type { RegionalGeofenceMapView } from '@/modules/regional-geofences/types';

export function useVehicleRegionalGeofence(vehicleId: string | null) {
  const [snapshot, setSnapshot] = useState<{
    vehicleId: string | null;
    data: RegionalGeofenceMapView | null;
  }>({ vehicleId: null, data: null });

  useEffect(() => {
    if (!vehicleId) return;
    const controller = new AbortController();
    fetch(`/api/map/regional-geofence?vehicleId=${encodeURIComponent(vehicleId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('regional-geofence-unavailable');
        return (await response.json()) as { geofence?: RegionalGeofenceMapView | null };
      })
      .then((payload) => setSnapshot({ vehicleId, data: payload.geofence ?? null }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSnapshot({ vehicleId, data: null });
        }
      });
    return () => controller.abort();
  }, [vehicleId]);

  return {
    data: snapshot.vehicleId === vehicleId ? snapshot.data : null,
    loading: Boolean(vehicleId && snapshot.vehicleId !== vehicleId),
  };
}
