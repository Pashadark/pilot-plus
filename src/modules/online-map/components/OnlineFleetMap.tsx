'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import { Button, EmptyState, ErrorState } from '@/shared/ui';

import { getFleetMapFallbackStyle, getFleetMapStyleUrl, type FleetMapTheme } from '../map-style';
import type {
  VehicleTrackEventView,
  VehicleTrackPeriodViewModel,
  VehicleTrackPoint,
  VehicleTrackSegment,
} from '../track-types';
import type { OnlineMapVehicle } from '../types';
import type { RegionalGeofenceMapView } from '@/modules/regional-geofences/types';
import { TrackEventPopup } from './TrackEventPopup';
import styles from './OnlineFleetMap.module.css';
import {
  mountVehicleTrackLayers,
  setVehicleTrackPlaybackTrail,
  VehicleTrackDataSurface,
} from './VehicleTrackLayers';
import { normalizeHeading, VehicleMapMarker } from './VehicleMapMarker';

import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_MAP_CENTER: [number, number] = [37.6176, 55.7558];
const MAP_LOAD_TIMEOUT_MS = 10_000;
const RUSSIAN_MAP_LOCALE = {
  'Map.Title': 'Интерактивная карта автопарка',
  'Marker.Title': 'Маркер автомобиля',
  'NavigationControl.ZoomIn': 'Увеличить масштаб',
  'NavigationControl.ZoomOut': 'Уменьшить масштаб',
  'NavigationControl.ResetBearing': 'Повернуть карту или вернуть север наверх',
};

interface MarkerResource {
  vehicleId: string;
  marker: maplibregl.Marker;
  root: Root;
}

function flyToVehicle(map: maplibregl.Map, vehicle: OnlineMapVehicle) {
  if (vehicle.longitude == null || vehicle.latitude == null) return;
  map.flyTo({
    center: [vehicle.longitude, vehicle.latitude],
    zoom: 14,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200,
  });
}

export interface OnlineFleetMapProps {
  vehicles: readonly OnlineMapVehicle[];
  selectedVehicleId: string | null;
  regionalGeofence?: RegionalGeofenceMapView | null;
  trackViewModel: VehicleTrackPeriodViewModel | null;
  playbackPoint: VehicleTrackPoint | null;
  playbackHeading?: number;
  playbackTrail?: readonly VehicleTrackPoint[] | null;
  playbackActive?: boolean;
  selectedEventId: string | null;
  previewedEventId: string | null;
  previewedSegmentId: string | null;
  onVehicleSelect: (vehicle: OnlineMapVehicle) => void;
  onEventPreview: (event: VehicleTrackEventView | null) => void;
  onEventActivate: (event: VehicleTrackEventView) => void;
  onSegmentPreview: (segment: VehicleTrackSegment | null) => void;
}

export function OnlineFleetMap({
  vehicles,
  selectedVehicleId,
  regionalGeofence = null,
  trackViewModel,
  playbackPoint,
  playbackHeading = 0,
  playbackTrail = null,
  playbackActive = false,
  selectedEventId,
  previewedEventId,
  previewedSegmentId,
  onVehicleSelect,
  onEventPreview,
  onEventActivate,
  onSegmentPreview,
}: OnlineFleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fittedTrackRef = useRef<{ map: maplibregl.Map; key: string } | null>(null);
  const mapReadyRef = useRef(false);
  const markersRef = useRef<MarkerResource[]>([]);
  const playbackMarkerRef = useRef<maplibregl.Marker | null>(null);
  const trackCleanupRef = useRef<(() => void) | null>(null);
  const positionedVehiclesRef = useRef<
    readonly (OnlineMapVehicle & { longitude: number; latitude: number })[]
  >([]);
  const selectedVehicleIdRef = useRef(selectedVehicleId);
  const selectedEventIdRef = useRef(selectedEventId);
  const onVehicleSelectRef = useRef(onVehicleSelect);
  const playbackPointRef = useRef(playbackPoint);
  const playbackTrailRef = useRef(playbackTrail);
  const playbackActiveRef = useRef(playbackActive);
  const onEventPreviewRef = useRef(onEventPreview);
  const onEventActivateRef = useRef(onEventActivate);
  const onSegmentPreviewRef = useRef(onSegmentPreview);
  const segmentPreviewRef = useRef<(segment: VehicleTrackSegment | null) => void>(() => {});
  const eventPreviewRef = useRef<(event: VehicleTrackEventView, count: number) => void>(() => {});
  const eventPreviewCloseRef = useRef(() => {});
  const [failedInstanceKey, setFailedInstanceKey] = useState<string | null>(null);
  const [failedTrackAttempt, setFailedTrackAttempt] = useState<number | null>(null);
  const [trackInteractionKey, setTrackInteractionKey] = useState<string | null>(null);
  const [trackAttempt, setTrackAttempt] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [mapTheme, setMapTheme] = useState<FleetMapTheme>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light',
  );
  const vehiclesSnapshotKey = JSON.stringify(vehicles);
  const stableVehicles = useMemo(
    () => JSON.parse(vehiclesSnapshotKey) as readonly OnlineMapVehicle[],
    [vehiclesSnapshotKey],
  );
  const positionedVehicles = useMemo(
    () =>
      stableVehicles.filter(
        (vehicle) => vehicle.longitude != null && vehicle.latitude != null,
      ) as readonly (OnlineMapVehicle & { longitude: number; latitude: number })[],
    [stableVehicles],
  );
  const instanceKey = `${attempt}:${mapTheme}:${stableVehicles.map((vehicle) => vehicle.id).join('|')}`;
  const trackLayerFailed = failedTrackAttempt === trackAttempt;

  useEffect(() => {
    positionedVehiclesRef.current = positionedVehicles;
  }, [positionedVehicles]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setMapTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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
    playbackTrailRef.current = playbackTrail;
    playbackActiveRef.current = playbackActive;
  }, [playbackActive, playbackTrail]);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    onEventPreviewRef.current = onEventPreview;
  }, [onEventPreview]);

  useEffect(() => {
    onEventActivateRef.current = onEventActivate;
  }, [onEventActivate]);

  useEffect(() => {
    onSegmentPreviewRef.current = onSegmentPreview;
  }, [onSegmentPreview]);

  useEffect(() => {
    const container = containerRef.current;
    const initialPositionedVehicles = positionedVehiclesRef.current;
    if (!container || initialPositionedVehicles.length === 0) return;

    mapReadyRef.current = false;
    const map = new maplibregl.Map({
      container,
      attributionControl: { compact: false },
      style: getFleetMapStyleUrl(mapTheme),
      center: initialPositionedVehicles[0]
        ? [initialPositionedVehicles[0].longitude, initialPositionedVehicles[0].latitude]
        : DEFAULT_MAP_CENTER,
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

    let fallbackTimeout: number | null = null;
    const handleLoad = () => {
      window.clearTimeout(loadTimeout);
      if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout);
      mapReadyRef.current = true;
      setFailedInstanceKey(null);
      map.resize();
    };
    map.once('load', handleLoad);
    const loadTimeout = window.setTimeout(() => {
      if (map.loaded()) return;
      try {
        map.setStyle(getFleetMapFallbackStyle());
        fallbackTimeout = window.setTimeout(() => {
          if (!map.loaded()) setFailedInstanceKey(instanceKey);
        }, MAP_LOAD_TIMEOUT_MS);
      } catch {
        setFailedInstanceKey(instanceKey);
      }
    }, MAP_LOAD_TIMEOUT_MS);

    const resizeFrame = window.requestAnimationFrame(() => map.resize());
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    const markerResources = initialPositionedVehicles.map((vehicle) => {
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

      const marker = new maplibregl.Marker({
        element,
        anchor: 'center',
        pitchAlignment: 'map',
        rotationAlignment: 'map',
        rotation: normalizeHeading(vehicle.heading),
      })
        .setLngLat([vehicle.longitude, vehicle.latitude])
        .addTo(map);
      element.removeAttribute('aria-label');
      element.removeAttribute('role');

      return { vehicleId: vehicle.id, marker, root };
    });

    markersRef.current = markerResources;

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      window.clearTimeout(loadTimeout);
      if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout);
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
  }, [instanceKey, mapTheme]);

  useEffect(() => {
    for (const resource of markersRef.current) {
      const vehicle = positionedVehicles.find((candidate) => candidate.id === resource.vehicleId);
      if (!vehicle) continue;
      resource.marker.setLngLat([vehicle.longitude, vehicle.latitude]);
      resource.marker.setRotation(normalizeHeading(vehicle.heading));
      const { root } = resource;
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
  }, [positionedVehicles, selectedVehicleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !regionalGeofence) return;
    let disposed = false;
    const sourceIds = ['regional-geofence-regions', 'regional-geofence-outer'] as const;
    const layerIds = [
      'regional-geofence-fill',
      'regional-geofence-inner-lines',
      'regional-geofence-outer-line',
    ] as const;
    const mount = () => {
      if (disposed || map.getSource(sourceIds[0])) return;
      const beforeId = map.getLayer('vehicle-track-casing') ? 'vehicle-track-casing' : undefined;
      map.addSource(sourceIds[0], {
        type: 'geojson',
        data: regionalGeofence.regionFeatures as GeoJSON.FeatureCollection,
      });
      map.addSource(sourceIds[1], {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: regionalGeofence.geometry,
        } as GeoJSON.Feature,
      });
      map.addLayer(
        {
          id: layerIds[0],
          type: 'fill',
          source: sourceIds[0],
          paint: {
            'fill-color': '#0067ff',
            'fill-opacity': mapTheme === 'dark' ? 0.13 : 0.1,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: layerIds[1],
          type: 'line',
          source: sourceIds[0],
          paint: {
            'line-color': mapTheme === 'dark' ? '#777782' : '#64748b',
            'line-opacity': 0.42,
            'line-width': 0.7,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: layerIds[2],
          type: 'line',
          source: sourceIds[1],
          paint: {
            'line-color': mapTheme === 'dark' ? '#62a0ff' : '#0057d9',
            'line-opacity': 0.9,
            'line-width': 2,
          },
        },
        beforeId,
      );
    };
    if (mapReadyRef.current || map.loaded()) mount();
    else map.once('load', mount);
    return () => {
      disposed = true;
      map.off('load', mount);
      for (const layerId of [...layerIds].reverse()) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      for (const sourceId of [...sourceIds].reverse()) {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    };
  }, [instanceKey, mapTheme, regionalGeofence]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trackViewModel) {
      fittedTrackRef.current = null;
      setFailedTrackAttempt(null);
      setTrackInteractionKey(null);
      return;
    }

    const currentTrackInteractionKey = getTrackResourceKey(trackViewModel);
    let disposed = false;
    let layersCleanup: (() => void) | null = null;
    let segmentPopup: maplibregl.Popup | null = null;
    let eventPreviewPopup: maplibregl.Popup | null = null;
    let eventSelectedPopup: maplibregl.Popup | null = null;
    let eventPreviewPopupRoot: Root | null = null;
    let eventSelectedPopupRoot: Root | null = null;
    let fitResizeObserver: ResizeObserver | null = null;

    const cleanupTrack = () => {
      if (disposed) return;
      disposed = true;
      map.off('load', mountTrack);
      layersCleanup?.();
      layersCleanup = null;
      segmentPopup?.remove();
      eventPreviewPopup?.remove();
      eventSelectedPopup?.remove();
      segmentPopup = null;
      eventPreviewPopup = null;
      eventSelectedPopup = null;
      if (eventPreviewPopupRoot) {
        const root = eventPreviewPopupRoot;
        eventPreviewPopupRoot = null;
        queueMicrotask(() => root.unmount());
      }
      if (eventSelectedPopupRoot) {
        const root = eventSelectedPopupRoot;
        eventSelectedPopupRoot = null;
        queueMicrotask(() => root.unmount());
      }
      playbackMarkerRef.current?.remove();
      playbackMarkerRef.current = null;
      segmentPreviewRef.current = () => {};
      eventPreviewRef.current = () => {};
      eventPreviewCloseRef.current = () => {};
      fitResizeObserver?.disconnect();
      fitResizeObserver = null;
      setTrackInteractionKey((current) =>
        current === currentTrackInteractionKey ? null : current,
      );
      if (trackCleanupRef.current === cleanupTrack) trackCleanupRef.current = null;
    };

    const mountTrack = () => {
      if (disposed) return;

      try {
        const eventPreviewPopupElement = document.createElement('div');
        const eventSelectedPopupElement = document.createElement('div');
        segmentPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
        });
        eventPreviewPopup = new maplibregl.Popup({
          className: 'maplibregl-popup-track-pointer',
          closeButton: false,
          closeOnClick: false,
          focusAfterOpen: false,
          offset: 16,
        });
        eventSelectedPopup = new maplibregl.Popup({
          closeButton: true,
          focusAfterOpen: false,
          offset: 16,
        });
        eventPreviewPopupRoot = createRoot(eventPreviewPopupElement);
        eventSelectedPopupRoot = createRoot(eventSelectedPopupElement);

        const handleSegmentPreview = (segment: VehicleTrackSegment | null) => {
          if (!segment) {
            segmentPopup?.remove();
            onSegmentPreviewRef.current(null);
            return;
          }
          segmentPopup
            ?.setLngLat([...segment.to.coordinates])
            .setDOMContent(createSegmentPopupContent(segment))
            .addTo(map);
          onSegmentPreviewRef.current(segment);
        };
        const showEvent = (
          popup: maplibregl.Popup | null,
          root: Root | null,
          element: HTMLDivElement,
          event: VehicleTrackEventView,
          count: number,
        ) => {
          if (!popup || !root) return;
          root.render(<TrackEventPopup event={event} count={count} />);
          popup
            .setLngLat([...event.coordinates])
            .setDOMContent(element)
            .addTo(map);
        };
        const showEventPreview = (event: VehicleTrackEventView, count: number) =>
          showEvent(
            eventPreviewPopup,
            eventPreviewPopupRoot,
            eventPreviewPopupElement,
            event,
            count,
          );
        const closeEventPreview = () => eventPreviewPopup?.remove();
        const handleEventPreview = (event: VehicleTrackEventView | null) => {
          if (!event) {
            closeEventPreview();
            onEventPreviewRef.current(null);
            return;
          }
          const count = trackViewModel.events.filter(
            (candidate) =>
              candidate.tripId === event.tripId &&
              candidate.coordinates[0] === event.coordinates[0] &&
              candidate.coordinates[1] === event.coordinates[1],
          ).length;
          showEventPreview(event, count);
          onEventPreviewRef.current(event);
        };
        const activateEvent = (event: VehicleTrackEventView) => {
          const count = trackViewModel.events.filter(
            (candidate) =>
              candidate.tripId === event.tripId &&
              candidate.coordinates[0] === event.coordinates[0] &&
              candidate.coordinates[1] === event.coordinates[1],
          ).length;
          showEvent(
            eventSelectedPopup,
            eventSelectedPopupRoot,
            eventSelectedPopupElement,
            event,
            count,
          );
          onEventActivateRef.current(event);
        };
        segmentPreviewRef.current = handleSegmentPreview;
        eventPreviewRef.current = showEventPreview;
        eventPreviewCloseRef.current = closeEventPreview;

        layersCleanup = mountVehicleTrackLayers(map, {
          trackViewModel,
          selectedEventId: selectedEventIdRef.current,
          onSegmentPreview: handleSegmentPreview,
          onEventPreview: handleEventPreview,
          onEventActivate: activateEvent,
        });
        setVehicleTrackPlaybackTrail(
          map,
          trackViewModel,
          playbackPointRef.current,
          playbackTrailRef.current,
          playbackActiveRef.current,
        );

        if (
          fittedTrackRef.current?.map !== map ||
          fittedTrackRef.current.key !== currentTrackInteractionKey
        ) {
          fitTrackBounds(map, trackViewModel, containerRef.current);
          fittedTrackRef.current = { map, key: currentTrackInteractionKey };
        }
        let layoutSignature = getMapLayoutSignature(containerRef.current);
        fitResizeObserver = new ResizeObserver(() => {
          const nextLayoutSignature = getMapLayoutSignature(containerRef.current);
          if (nextLayoutSignature === layoutSignature) return;
          layoutSignature = nextLayoutSignature;
          fitTrackBounds(map, trackViewModel, containerRef.current);
        });
        if (containerRef.current) fitResizeObserver.observe(containerRef.current);
        if (playbackPointRef.current) {
          playbackMarkerRef.current = createPlaybackMarker(map, playbackPointRef.current);
        }
        setTrackInteractionKey(currentTrackInteractionKey);
        setFailedTrackAttempt(null);
      } catch {
        layersCleanup?.();
        layersCleanup = null;
        segmentPopup?.remove();
        eventPreviewPopup?.remove();
        eventSelectedPopup?.remove();
        if (eventPreviewPopupRoot) {
          const root = eventPreviewPopupRoot;
          eventPreviewPopupRoot = null;
          queueMicrotask(() => root.unmount());
        }
        if (eventSelectedPopupRoot) {
          const root = eventSelectedPopupRoot;
          eventSelectedPopupRoot = null;
          queueMicrotask(() => root.unmount());
        }
        playbackMarkerRef.current?.remove();
        playbackMarkerRef.current = null;
        setTrackInteractionKey(null);
        setFailedTrackAttempt(trackAttempt);
      }
    };

    trackCleanupRef.current = cleanupTrack;

    if (mapReadyRef.current || map.loaded()) {
      mapReadyRef.current = true;
      mountTrack();
    } else {
      map.once('load', mountTrack);
    }

    return cleanupTrack;
  }, [instanceKey, trackAttempt, trackViewModel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource('vehicle-track-events') || !trackViewModel) return;

    try {
      const selectedEvent = trackViewModel.events.find((event) => event.id === selectedEventId);
      for (const event of trackViewModel.eventGroups) {
        map.setFeatureState(
          { source: 'vehicle-track-events', id: event.id },
          {
            selected:
              event.id === selectedEventId ||
              (selectedEvent !== undefined &&
                event.tripId === selectedEvent.tripId &&
                event.coordinates[0] === selectedEvent.coordinates[0] &&
                event.coordinates[1] === selectedEvent.coordinates[1]),
          },
        );
      }
    } catch {
      queueMicrotask(() => setFailedTrackAttempt(trackAttempt));
    }
  }, [instanceKey, selectedEventId, trackAttempt, trackViewModel]);

  useEffect(() => {
    if (!trackViewModel) return;
    const event = trackViewModel.events.find(
      (candidate) =>
        candidate.id === previewedEventId ||
        (previewedEventId === null && candidate.id === selectedEventId),
    );
    if (!event) {
      eventPreviewCloseRef.current();
      return;
    }
    const count = trackViewModel.events.filter(
      (candidate) =>
        candidate.tripId === event.tripId &&
        candidate.coordinates[0] === event.coordinates[0] &&
        candidate.coordinates[1] === event.coordinates[1],
    ).length;
    eventPreviewRef.current(event, count);
  }, [previewedEventId, selectedEventId, trackAttempt, trackInteractionKey, trackViewModel]);

  useEffect(() => {
    if (!trackViewModel) return;
    const segment =
      trackViewModel.segments.find((candidate) => candidate.id === previewedSegmentId) ?? null;
    segmentPreviewRef.current(segment);
  }, [previewedSegmentId, trackAttempt, trackInteractionKey, trackViewModel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trackViewModel) return;

    try {
      setVehicleTrackPlaybackTrail(
        map,
        trackViewModel,
        playbackPoint,
        playbackTrail,
        playbackActive,
      );
      if (!playbackPoint) {
        playbackMarkerRef.current?.remove();
        playbackMarkerRef.current = null;
        return;
      }

      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.getElement().dataset.playbackPoint = playbackPoint.id;
        playbackMarkerRef.current.setLngLat([...playbackPoint.coordinates]);
        playbackMarkerRef.current.setRotation(normalizeHeading(playbackHeading));
      } else if (mapReadyRef.current) {
        playbackMarkerRef.current = createPlaybackMarker(map, playbackPoint, playbackHeading);
      }
    } catch {
      playbackMarkerRef.current?.remove();
      playbackMarkerRef.current = null;
      queueMicrotask(() => setFailedTrackAttempt(trackAttempt));
    }
  }, [
    instanceKey,
    playbackActive,
    playbackHeading,
    playbackPoint,
    playbackTrail,
    trackAttempt,
    trackViewModel,
  ]);

  if (positionedVehicles.length === 0) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-canvas)] p-4">
        <EmptyState
          title="Координаты ещё не получены"
          description="Машины доступны в списке сверху. После синхронизации они появятся на карте."
        />
      </div>
    );
  }

  return (
    <div
      className={`${styles.mapShell} relative h-full w-full [&_.maplibregl-ctrl-bottom-right]:right-3 [&_.maplibregl-ctrl-bottom-right]:bottom-[calc(48dvh+max(1rem,env(safe-area-inset-bottom)))] @min-[48rem]:[&_.maplibregl-ctrl-bottom-right]:right-[26rem] @min-[48rem]:[&_.maplibregl-ctrl-bottom-right]:bottom-4`}
    >
      <div
        ref={containerRef}
        className={`${styles.mapLoadingPattern} h-full w-full [&_.maplibregl-ctrl-group]:flex [&_.maplibregl-ctrl-group_button]:size-11`}
        aria-label="Онлайн-карта автопарка"
      />
      {trackViewModel ? (
        <VehicleTrackDataSurface
          trackViewModel={trackViewModel}
          ready={trackInteractionKey === getTrackResourceKey(trackViewModel) && !trackLayerFailed}
        />
      ) : null}
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
          className="absolute top-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-card)]"
        >
          <span>Маршрут временно недоступен</span>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Повторить маршрут"
            onClick={() => {
              setTrackAttempt((value) => value + 1);
            }}
          >
            Повторить
          </Button>
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

function fitTrackBounds(
  map: maplibregl.Map,
  track: VehicleTrackPeriodViewModel,
  container: HTMLElement | null,
) {
  const bounds = new maplibregl.LngLatBounds();

  for (const segment of track.segments) {
    bounds.extend([...segment.from.coordinates]);
    bounds.extend([...segment.to.coordinates]);
  }

  const width = container?.clientWidth ?? 0;
  const height = container?.clientHeight ?? 0;
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  map.fitBounds(bounds, getTrackFitOptions(width, height, reducedMotion));
}

export function getTrackFitOptions(width: number, height: number, reducedMotion: boolean) {
  const desktop = width >= 768;

  return {
    padding: desktop
      ? { top: 72, right: 416, bottom: 88, left: 392 }
      : {
          top: 144,
          right: 24,
          bottom: Math.round(height * 0.48) + 24,
          left: 24,
        },
    duration: reducedMotion ? 0 : 350,
    maxZoom: 15,
  };
}

function getMapLayoutSignature(container: HTMLElement | null): string {
  if (!container) return 'missing';
  return `${container.clientWidth >= 768 ? 'desktop' : 'mobile'}:${
    container.clientWidth >= container.clientHeight ? 'landscape' : 'portrait'
  }`;
}

function getTrackResourceKey(track: VehicleTrackPeriodViewModel): string {
  return `${track.vehicleId}:${track.period}:${track.trips.map((trip) => trip.date).join('|')}`;
}

function createPlaybackMarker(
  map: maplibregl.Map,
  point: VehicleTrackPoint,
  heading = 0,
): maplibregl.Marker {
  const element = document.createElement('div');
  element.setAttribute('aria-label', 'Положение автомобиля на маршруте');
  element.dataset.playbackPoint = point.id;
  element.className =
    'size-5 border-2 border-white bg-[var(--color-primary)] shadow-[var(--shadow-card)]';
  element.style.clipPath = 'polygon(50% 0%, 100% 100%, 50% 72%, 0% 100%)';
  return new maplibregl.Marker({
    element,
    anchor: 'center',
    pitchAlignment: 'map',
    rotationAlignment: 'map',
    rotation: normalizeHeading(heading),
  })
    .setLngLat([...point.coordinates])
    .addTo(map);
}
