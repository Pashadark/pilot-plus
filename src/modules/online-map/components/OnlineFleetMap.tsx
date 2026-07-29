'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import { Button, EmptyState, ErrorState } from '@/shared/ui';

import type { OnlineMapVehicle } from '../types';
import { VehicleMapMarker } from './VehicleMapMarker';

import 'maplibre-gl/dist/maplibre-gl.css';

const KRASNOYARSK_CENTER: [number, number] = [92.87, 56.01];

interface MarkerResource {
  vehicle: OnlineMapVehicle;
  marker: maplibregl.Marker;
  root: Root;
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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    onVehicleSelectRef.current = onVehicleSelect;
  }, [onVehicleSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || vehicles.length === 0) return;

    const map = new maplibregl.Map({
      container,
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
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    const handleError = () => setFailed(true);
    const handleLoad = () => map.resize();
    map.on('error', handleError);
    map.once('load', handleLoad);

    const resizeFrame = window.requestAnimationFrame(() => map.resize());
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    const markerResources = vehicles.map((vehicle) => {
      const element = document.createElement('div');
      const root = createRoot(element);
      const selectVehicle = (selectedVehicle: OnlineMapVehicle) => {
        onVehicleSelectRef.current(selectedVehicle);
        map.flyTo({
          center: [selectedVehicle.longitude, selectedVehicle.latitude],
          zoom: 14,
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600,
        });
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

      return { vehicle, marker, root };
    });

    markersRef.current = markerResources;

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      map.off('error', handleError);
      map.off('load', handleLoad);
      for (const { marker, root } of markerResources) {
        marker.remove();
        root.unmount();
      }
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [attempt, vehicles]);

  useEffect(() => {
    for (const { root, vehicle } of markersRef.current) {
      root.render(
        <VehicleMapMarker
          vehicle={vehicle}
          selected={selectedVehicleId === vehicle.id}
          onSelect={(selectedVehicle) => {
            onVehicleSelectRef.current(selectedVehicle);
            mapRef.current?.flyTo({
              center: [selectedVehicle.longitude, selectedVehicle.latitude],
              zoom: 14,
              duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600,
            });
          }}
        />,
      );
    }
  }, [selectedVehicleId]);

  if (vehicles.length === 0) {
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
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full [&_.maplibregl-ctrl-group_button]:size-11"
        aria-label="Онлайн-карта автопарка"
      />
      {failed && (
        <div className="absolute inset-4 z-10 grid place-items-center">
          <ErrorState
            title="Не удалось загрузить карту"
            description="Проверьте подключение к сети и повторите попытку."
            action={
              <Button
                onClick={() => {
                  setFailed(false);
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
