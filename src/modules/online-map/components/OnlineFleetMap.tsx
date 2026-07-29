'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import { Button, EmptyState, ErrorState } from '@/shared/ui';

import type {
  VehicleTrackEventView,
  VehicleTrackPoint,
  VehicleTrackSegment,
  VehicleTrackViewModel,
} from '../track-types';
import type { OnlineMapVehicle } from '../types';
import { TrackEventPopup } from './TrackEventPopup';
import { mountVehicleTrackLayers } from './VehicleTrackLayers';
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
const ignoreTrackEvent: (event: VehicleTrackEventView) => void = () => undefined;

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
  trackViewModel?: VehicleTrackViewModel | null;
  playbackPoint?: VehicleTrackPoint | null;
  selectedEventId?: string | null;
  onVehicleSelect: (vehicle: OnlineMapVehicle) => void;
  onEventSelect?: (event: VehicleTrackEventView) => void;
  onPlaybackProgressRequest?: (event: VehicleTrackEventView) => void;
}

export function OnlineFleetMap({
  vehicles,
  selectedVehicleId,
  trackViewModel = null,
  playbackPoint = null,
  selectedEventId = null,
  onVehicleSelect,
  onEventSelect = ignoreTrackEvent,
  onPlaybackProgressRequest = ignoreTrackEvent,
}: OnlineFleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const markersRef = useRef<MarkerResource[]>([]);
  const playbackMarkerRef = useRef<maplibregl.Marker | null>(null);
  const trackCleanupRef = useRef<(() => void) | null>(null);
  const selectedVehicleIdRef = useRef(selectedVehicleId);
  const selectedEventIdRef = useRef(selectedEventId);
  const onVehicleSelectRef = useRef(onVehicleSelect);
  const playbackPointRef = useRef(playbackPoint);
  const onEventSelectRef = useRef(onEventSelect);
  const onPlaybackProgressRequestRef = useRef(onPlaybackProgressRequest);
  const [failedInstanceKey, setFailedInstanceKey] = useState<string | null>(null);
  const [trackLayerFailed, setTrackLayerFailed] = useState(false);
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
    playbackPointRef.current = playbackPoint;
  }, [playbackPoint]);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    onEventSelectRef.current = onEventSelect;
  }, [onEventSelect]);

  useEffect(() => {
    onPlaybackProgressRequestRef.current = onPlaybackProgressRequest;
  }, [onPlaybackProgressRequest]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || stableVehicles.length === 0) return;

    mapReadyRef.current = false;
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
      mapReadyRef.current = true;
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
      trackCleanupRef.current?.();
      mapReadyRef.current = false;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trackViewModel) {
      setTrackLayerFailed(false);
      return;
    }

    let disposed = false;
    let layersCleanup: (() => void) | null = null;
    let segmentPopup: maplibregl.Popup | null = null;
    let eventPopup: maplibregl.Popup | null = null;
    let eventPopupRoot: Root | null = null;

    const cleanupTrack = () => {
      if (disposed) return;
      disposed = true;
      map.off('load', mountTrack);
      layersCleanup?.();
      layersCleanup = null;
      segmentPopup?.remove();
      eventPopup?.remove();
      segmentPopup = null;
      eventPopup = null;
      if (eventPopupRoot) {
        const root = eventPopupRoot;
        eventPopupRoot = null;
        queueMicrotask(() => root.unmount());
      }
      playbackMarkerRef.current?.remove();
      playbackMarkerRef.current = null;
      if (trackCleanupRef.current === cleanupTrack) trackCleanupRef.current = null;
    };

    const mountTrack = () => {
      if (disposed) return;

      try {
        const eventPopupElement = document.createElement('div');
        segmentPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
        });
        eventPopup = new maplibregl.Popup({ closeButton: true, offset: 16 });
        eventPopupRoot = createRoot(eventPopupElement);

        layersCleanup = mountVehicleTrackLayers(map, {
          trackViewModel,
          selectedEventId: selectedEventIdRef.current,
          onSegmentHover: (segment, coordinates) => {
            if (!segmentPopup) return;
            segmentPopup
              .setLngLat([...coordinates])
              .setDOMContent(createSegmentPopupContent(segment))
              .addTo(map);
          },
          onSegmentLeave: () => segmentPopup?.remove(),
          onEventSelect: (event, count) => {
            if (!eventPopup || !eventPopupRoot) return;
            eventPopupRoot.render(<TrackEventPopup event={event} count={count} />);
            eventPopup
              .setLngLat([...event.coordinates])
              .setDOMContent(eventPopupElement)
              .addTo(map);
            onEventSelectRef.current(event);
          },
          onPlaybackProgressRequest: (event) => {
            onPlaybackProgressRequestRef.current(event);
          },
        });

        fitTrackBounds(map, trackViewModel);
        if (playbackPointRef.current) {
          playbackMarkerRef.current = createPlaybackMarker(map, playbackPointRef.current);
        }
        setTrackLayerFailed(false);
      } catch {
        layersCleanup?.();
        layersCleanup = null;
        segmentPopup?.remove();
        eventPopup?.remove();
        if (eventPopupRoot) {
          const root = eventPopupRoot;
          eventPopupRoot = null;
          queueMicrotask(() => root.unmount());
        }
        playbackMarkerRef.current?.remove();
        playbackMarkerRef.current = null;
        setTrackLayerFailed(true);
      }
    };

    trackCleanupRef.current = cleanupTrack;

    if (mapReadyRef.current) {
      mountTrack();
    } else {
      map.once('load', mountTrack);
    }

    return cleanupTrack;
  }, [instanceKey, trackViewModel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource('vehicle-track-events') || !trackViewModel) return;

    try {
      for (const event of trackViewModel.eventGroups) {
        map.setFeatureState(
          { source: 'vehicle-track-events', id: event.id },
          { selected: event.id === selectedEventId },
        );
      }
    } catch {
      queueMicrotask(() => setTrackLayerFailed(true));
    }
  }, [instanceKey, selectedEventId, trackViewModel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trackViewModel) return;

    try {
      if (!playbackPoint) {
        playbackMarkerRef.current?.remove();
        playbackMarkerRef.current = null;
        return;
      }

      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.setLngLat([...playbackPoint.coordinates]);
      } else if (mapReadyRef.current) {
        playbackMarkerRef.current = createPlaybackMarker(map, playbackPoint);
      }
    } catch {
      playbackMarkerRef.current?.remove();
      playbackMarkerRef.current = null;
      queueMicrotask(() => setTrackLayerFailed(true));
    }
  }, [instanceKey, playbackPoint, trackViewModel]);

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
      {trackLayerFailed ? (
        <div
          role="status"
          className="absolute top-28 left-1/2 z-10 -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-card)]"
        >
          Маршрут временно недоступен
        </div>
      ) : null}
    </div>
  );
}

function createSegmentPopupContent(segment: VehicleTrackSegment): HTMLDivElement {
  const content = document.createElement('div');
  content.className = 'min-w-52 space-y-1 p-1 text-sm';

  const time = document.createElement('strong');
  time.textContent = `${segment.from.timestamp}–${segment.to.timestamp}`;
  const speed = document.createElement('p');
  speed.textContent = `Средняя скорость: ${segment.speedKph} км/ч`;
  const address = document.createElement('p');
  address.textContent = segment.to.address;

  content.append(time, speed, address);
  return content;
}

function fitTrackBounds(map: maplibregl.Map, track: VehicleTrackViewModel) {
  const bounds = new maplibregl.LngLatBounds();

  for (const segment of track.segments) {
    bounds.extend([...segment.from.coordinates]);
    bounds.extend([...segment.to.coordinates]);
  }

  const desktop = window.innerWidth >= 768;
  map.fitBounds(bounds, {
    padding: desktop
      ? { top: 32, right: 352, bottom: 32, left: 32 }
      : {
          top: 96,
          right: 24,
          bottom: Math.round(window.innerHeight * 0.48),
          left: 24,
        },
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350,
    maxZoom: 15,
  });
}

function createPlaybackMarker(map: maplibregl.Map, point: VehicleTrackPoint): maplibregl.Marker {
  const element = document.createElement('div');
  element.setAttribute('aria-label', 'Положение автомобиля на маршруте');
  element.dataset.playbackPoint = point.id;
  element.className =
    'size-4 rounded-full border-2 border-white bg-[var(--color-primary)] shadow-[var(--shadow-card)]';

  return new maplibregl.Marker({ element, anchor: 'center' })
    .setLngLat([...point.coordinates])
    .addTo(map);
}
