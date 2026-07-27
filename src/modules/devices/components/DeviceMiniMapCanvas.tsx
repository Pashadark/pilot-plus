'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

import { Button, ErrorState } from '@/shared/ui';

import 'maplibre-gl/dist/maplibre-gl.css';

export function DeviceMiniMapCanvas({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
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
      center: [longitude, latitude],
      zoom: 14,
    });
    const marker = new maplibregl.Marker({ color: 'var(--color-primary)' })
      .setLngLat([longitude, latitude])
      .addTo(map);
    const handleError = () => setFailed(true);
    const handleLoad = () => map.resize();
    map.on('error', handleError);
    map.once('load', handleLoad);
    const frame = window.requestAnimationFrame(() => map.resize());
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      map.off('error', handleError);
      map.off('load', handleLoad);
      marker.remove();
      map.remove();
    };
  }, [attempt, latitude, longitude]);

  return (
    <div className="relative h-56 overflow-hidden sm:h-64" data-testid="device-mini-map">
      <div ref={containerRef} className="h-full w-full" aria-label="Карта положения устройства" />
      {failed ? (
        <div className="absolute inset-3 grid place-items-center">
          <ErrorState
            title="Не удалось загрузить карту"
            description="Проверьте подключение и повторите попытку."
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
      ) : null}
    </div>
  );
}
