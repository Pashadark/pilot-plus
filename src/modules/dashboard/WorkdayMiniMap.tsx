'use client';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { getFleetMapStyleUrl } from '@/modules/online-map/map-style';
import type { DashboardFleetVehicle } from './overview-types';
import 'maplibre-gl/dist/maplibre-gl.css';
export function collapseMiniMapAttribution(container: HTMLElement) {
  const attribution = container.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
  if (!attribution) return;
  attribution.open = false;
  attribution.classList.remove('maplibregl-compact-show');
}
export function WorkdayMiniMap({ fleet }: { fleet: DashboardFleetVehicle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import('maplibre-gl')
      .then(({ default: lib }) => {
        if (disposed || !ref.current) return;
        const points = fleet.filter((v) => v.position);
        const map = new lib.Map({
          container: ref.current,
          style: getFleetMapStyleUrl(theme),
          center: [37.62, 55.75],
          zoom: 9,
          interactive: false,
          attributionControl: { compact: true },
        });
        const bounds = new lib.LngLatBounds();
        for (const v of points) {
          const p = v.position!;
          bounds.extend([p.longitude, p.latitude]);
          new lib.Marker({ scale: 0.55, color: '#0c85ff' })
            .setLngLat([p.longitude, p.latitude])
            .addTo(map);
        }
        map.on('load', () => {
          if (points.length) map.fitBounds(bounds, { padding: 35, maxZoom: 12, duration: 0 });
          if (ref.current) collapseMiniMapAttribution(ref.current);
        });
        map.on('error', () => setFailed(true));
        const observer = new ResizeObserver(() => map.resize());
        observer.observe(ref.current);
        cleanup = () => {
          observer.disconnect();
          map.remove();
        };
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [fleet, theme]);
  return (
    <div className="workday-mini-map" aria-label="Последние известные позиции автомобилей">
      <div ref={ref} className="absolute inset-0" />
      {failed && <p className="relative p-4">Карта временно недоступна. Откройте онлайн-карту.</p>}
    </div>
  );
}
