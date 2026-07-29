'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import { Button, EmptyState, ErrorState } from '@/shared/ui';

import type { OnlineMapVehicle } from '../types';
import { VehicleMapMarker } from './VehicleMapMarker';

import 'maplibre-gl/dist/maplibre-gl.css';

const KRASNOYARSK_CENTER: [number, number] = [92.87, 56.01];
const MAP_LOAD_TIMEOUT_MS = 10_000;
const RUSSIAN_MAP_LOCALE = {
  'Map.Title': 'Интерактивная карта автопарка',
  'Marker.Title': 'Маркер автомобиля',
  'NavigationControl.ZoomIn': 'Увеличить масштаб',
  'NavigationControl.ZoomOut': 'Уменьшить масштаб',
  'NavigationControl.ResetBearing': 'Повернуть карту или вернуть север наверх',
};

interface MarkerResource {
  vehicle: OnlineMapVehicle;
  marker: maplibregl.Marker;
  root: Root;
}

function flyToVehicle(map: maplibregl.Map, vehicle: OnlineMapVehicle) {
  map.flyTo({
    center: [vehicle.longitude, vehicle.latitude],
    zoom: 14,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200,
  });
}

export interface OnlineFleetMapProps {
  vehicles: readonly OnlineMapVehicle[];
  selectedVehicleId: string | null;
  onVehicleSelect: (vehicle: OnlineMapVehicle) => void;
}

export function OnlineFleetMap({
  vehicles,
  selectedVehicleId,
  onVehicleSelect,
}: OnlineFleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<MarkerResource[]>([]);
  const selectedVehicleIdRef = useRef(selectedVehicleId);
  const onVehicleSelectRef = useRef(onVehicleSelect);
  const [failedInstanceKey, setFailedInstanceKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const vehiclesSnapshotKey = JSON.stringify(vehicles);
  const stableVehicles = useMemo(
    () => JSON.parse(vehiclesSnapshotKey) as readonly OnlineMapVehicle[],
    [vehiclesSnapshotKey],
  );
  const instanceKey = `${attempt}:${stableVehicles.map((vehicle) => vehicle.id).join('|')}`;

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    onVehicleSelectRef.current = onVehicleSelect;
  }, [onVehicleSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || stableVehicles.length === 0) return;

    const map = new maplibregl.Map({
      container,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: KRASNOYARSK_CENTER,
      zoom: 11,
      locale: RUSSIAN_MAP_LOCALE,
    });

    mapRef.current = map;
    const canvas = map.getCanvas();
    canvas.tabIndex = -1;
    const activateKeyboardMap = () => {
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    };
    canvas.addEventListener('pointerdown', activateKeyboardMap);
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    const handleLoad = () => {
      window.clearTimeout(loadTimeout);
      setFailedInstanceKey(null);
      map.resize();
    };
    map.once('load', handleLoad);
    const loadTimeout = window.setTimeout(() => {
      if (!map.loaded()) setFailedInstanceKey(instanceKey);
    }, MAP_LOAD_TIMEOUT_MS);

    const resizeFrame = window.requestAnimationFrame(() => map.resize());
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    const markerResources = stableVehicles.map((vehicle) => {
      const element = document.createElement('div');
      const root = createRoot(element);
      const selectVehicle = (selectedVehicle: OnlineMapVehicle) => {
        onVehicleSelectRef.current(selectedVehicle);
        flyToVehicle(map, selectedVehicle);
      };

      root.render(
        <VehicleMapMarker
          vehicle={vehicle}
          selected={selectedVehicleIdRef.current === vehicle.id}
          onSelect={selectVehicle}
        />,
      );

      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([vehicle.longitude, vehicle.latitude])
        .addTo(map);
      element.removeAttribute('aria-label');
      element.removeAttribute('role');

      return { vehicle, marker, root };
    });

    markersRef.current = markerResources;

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      window.clearTimeout(loadTimeout);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', activateKeyboardMap);
      map.off('load', handleLoad);
      for (const { marker, root } of markerResources) {
        marker.remove();
        queueMicrotask(() => root.unmount());
      }
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [instanceKey, stableVehicles]);

  useEffect(() => {
    for (const { root, vehicle } of markersRef.current) {
      root.render(
        <VehicleMapMarker
          vehicle={vehicle}
          selected={selectedVehicleId === vehicle.id}
          onSelect={(selectedVehicle) => {
            onVehicleSelectRef.current(selectedVehicle);
            if (mapRef.current) flyToVehicle(mapRef.current, selectedVehicle);
          }}
        />,
      );
    }
  }, [selectedVehicleId]);

  if (stableVehicles.length === 0) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-canvas)] p-4">
        <EmptyState
          title="На карте нет подходящих автомобилей"
          description="Измените поисковый запрос или выбранный фильтр."
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full [&_.maplibregl-ctrl-bottom-right]:right-3 [&_.maplibregl-ctrl-bottom-right]:bottom-[calc(42dvh+max(1rem,env(safe-area-inset-bottom)))] @min-[48rem]:[&_.maplibregl-ctrl-bottom-right]:right-[21rem] @min-[48rem]:[&_.maplibregl-ctrl-bottom-right]:bottom-4">
      <div
        ref={containerRef}
        className="h-full w-full [&_.maplibregl-ctrl-group]:flex [&_.maplibregl-ctrl-group_button]:size-11"
        aria-label="Онлайн-карта автопарка"
      />
      {failedInstanceKey === instanceKey && (
        <div className="absolute inset-4 z-10 grid place-items-center">
          <ErrorState
            title="Не удалось загрузить карту"
            description="Проверьте подключение к сети и повторите попытку."
            action={
              <Button
                onClick={() => {
                  setFailedInstanceKey(null);
                  setAttempt((value) => value + 1);
                }}
              >
                Повторить
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
