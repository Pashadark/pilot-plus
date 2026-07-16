'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import { Button, EmptyState, ErrorState } from '@/shared/ui';

import type { Vehicle, VehicleStatus } from './types';

import 'maplibre-gl/dist/maplibre-gl.css';

const statusColor: Record<VehicleStatus, string> = {
  moving: 'var(--color-primary)',
  idle: 'var(--color-warning)',
  offline: 'var(--color-text-secondary)',
  alarm: 'var(--color-danger)',
};

interface MarkerResource {
  marker: maplibregl.Marker;
  root: Root;
}

function MarkerContent({ vehicle, expanded }: { vehicle: Vehicle; expanded: boolean }) {
  return (
    <div
      className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border-2 border-[var(--color-surface)] px-2 text-xs font-semibold text-[var(--color-text-inverse)] shadow-[var(--shadow-floating)]"
      style={{ backgroundColor: statusColor[vehicle.status] }}
      aria-label={`${vehicle.name}, ${vehicle.plate}`}
    >
      {expanded ? vehicle.plate : vehicle.speedKph}
    </div>
  );
}

export function FleetMap({
  vehicles,
  mode,
  onVehicleSelect,
}: {
  vehicles: readonly Vehicle[];
  mode: 'desktop' | 'mobile';
  onVehicleSelect?: (vehicle: Vehicle) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!containerRef.current || vehicles.length === 0) return;

    const markerResources: MarkerResource[] = [];
    const map = new maplibregl.Map({
      container: containerRef.current,
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
      center: [vehicles[0].longitude, vehicles[0].latitude],
      zoom: mode === 'mobile' ? 10 : 11,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.on('error', () => setFailed(true));

    for (const vehicle of vehicles) {
      const element = document.createElement('button');
      element.type = 'button';
      element.setAttribute('aria-label', `Выбрать ${vehicle.name}`);
      const root = createRoot(element);
      root.render(<MarkerContent vehicle={vehicle} expanded={false} />);
      element.addEventListener('click', () => {
        setSelectedVehicle(vehicle);
        onVehicleSelect?.(vehicle);
        map.flyTo({ center: [vehicle.longitude, vehicle.latitude], zoom: 14, duration: 800 });
      });
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([vehicle.longitude, vehicle.latitude])
        .addTo(map);
      markerResources.push({ marker, root });
    }

    const updateMarkers = () => {
      const expanded = map.getZoom() > 12;
      markerResources.forEach(({ root }, index) => {
        const vehicle = vehicles[index];
        if (vehicle) root.render(<MarkerContent vehicle={vehicle} expanded={expanded} />);
      });
    };
    map.on('zoom', updateMarkers);

    return () => {
      map.off('zoom', updateMarkers);
      markerResources.forEach(({ marker, root }) => {
        marker.remove();
        root.unmount();
      });
      map.remove();
    };
  }, [attempt, mode, onVehicleSelect, vehicles]);

  if (vehicles.length === 0) {
    return (
      <div className="grid h-full place-items-center p-4">
        <EmptyState title="На карте пока нет транспорта" description="Измените фильтры или повторите позже." />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" data-selected-vehicle={selectedVehicle?.id}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Карта автопарка" />
      {failed && (
        <div className="absolute inset-4 z-10 grid place-items-center">
          <ErrorState
            title="Не удалось загрузить карту"
            description="Проверьте подключение и попробуйте ещё раз."
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
