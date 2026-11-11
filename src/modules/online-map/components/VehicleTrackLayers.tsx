import type { FeatureCollection, LineString, Point } from 'geojson';
import type { ExpressionSpecification, GeoJSONSource, Map, MapLayerMouseEvent } from 'maplibre-gl';
import { buildTrackGradientRuns, trackSpeedColor } from '../track-gradient';

import type {
  TrackCoordinates,
  VehicleTrackEventView,
  VehicleTrackPeriodViewModel,
  VehicleTrackSegment,
  VehicleTrackPoint,
} from '../track-types';
import { MAX_TRACK_POINT_GAP_MS } from '../track-types';

const TRACK_SOURCE_ID = 'vehicle-track';
const TRACK_EVENTS_SOURCE_ID = 'vehicle-track-events';
const TRACK_ENDPOINTS_SOURCE_ID = 'vehicle-track-endpoints';
const TRACK_PLAYBACK_SOURCE_ID = 'vehicle-track-playback';

const TRACK_LAYER_IDS = [
  'vehicle-track-event-hitbox',
  'vehicle-track-event-counts',
  'vehicle-track-event-metrics',
  'vehicle-track-event-icons',
  'vehicle-track-event-pulse',
  'vehicle-track-events',
  'vehicle-track-endpoint-labels',
  'vehicle-track-endpoints',
  'vehicle-track-directions',
  'vehicle-track-hitbox',
  'vehicle-track-lines',
  'vehicle-track-playback',
  'vehicle-track-casing',
] as const;

const TRACK_SOURCE_IDS = [
  TRACK_ENDPOINTS_SOURCE_ID,
  TRACK_EVENTS_SOURCE_ID,
  TRACK_SOURCE_ID,
  TRACK_PLAYBACK_SOURCE_ID,
] as const;

const EMPTY_PLAYBACK_TRAIL: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [],
};

export function setVehicleTrackPlaybackTrail(
  map: Map,
  trackViewModel: VehicleTrackPeriodViewModel,
  playbackPoint: VehicleTrackPoint | null,
  playbackTrail?: readonly VehicleTrackPoint[] | null,
  playbackActive?: boolean,
) {
  if (!hasMapStyle(map)) return;

  let source: GeoJSONSource | undefined;
  try {
    source = map.getSource(TRACK_PLAYBACK_SOURCE_ID) as GeoJSONSource | undefined;
  } catch {
    return;
  }
  if (!source || typeof source.setData !== 'function') return;

  const active = playbackActive ?? playbackPoint !== null;
  setBaseTrackVisibility(map, !active);

  if (!playbackPoint || !active) {
    source.setData(EMPTY_PLAYBACK_TRAIL);
    return;
  }

  if (playbackTrail) {
    source.setData({
      type: 'FeatureCollection',
      features: playbackTrail.slice(1).flatMap((to, index) => {
        const from = playbackTrail[index];
        if (!isConnectedPlaybackPair(from, to)) return [];
        return [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: [[...from.coordinates], [...to.coordinates]],
            },
          },
        ];
      }),
    });
    return;
  }

  const trip = trackViewModel.trips.find((candidate) =>
    candidate.segments.some(
      (segment) => segment.from.id === playbackPoint.id || segment.to.id === playbackPoint.id,
    ),
  );
  const endIndex = trip?.segments.findIndex((segment) => segment.to.id === playbackPoint.id) ?? -1;
  const visibleSegments = trip
    ? endIndex >= 0
      ? trip.segments.slice(0, endIndex + 1)
      : playbackPoint.id === trip.finish.id
        ? trip.segments
        : []
    : [];

  source.setData({
    type: 'FeatureCollection',
    features: visibleSegments.map((segment) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [[...segment.from.coordinates], [...segment.to.coordinates]],
      },
    })),
  });
}

function setBaseTrackVisibility(map: Map, visible: boolean) {
  const fixedLayerIds = [
    'vehicle-track-casing',
    'vehicle-track-lines',
    'vehicle-track-directions',
    'vehicle-track-speed-labels',
  ];
  let layerIds = fixedLayerIds;

  try {
    const gradientLayerIds =
      map
        .getStyle()
        .layers?.map((layer) => layer.id)
        .filter((id) => id.startsWith('vehicle-track-gradient-')) ?? [];
    layerIds = [...fixedLayerIds, ...gradientLayerIds];
  } catch {
    // The style can be between MapLibre lifecycle states during a theme reload.
  }

  for (const layerId of layerIds) {
    try {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    } catch {
      // A style reload may remove a layer between getLayer and setLayoutProperty.
    }
  }
}

function isConnectedPlaybackPair(from: VehicleTrackPoint, to: VehicleTrackPoint): boolean {
  const fromRecordedAt = from.recordedAt ? Date.parse(from.recordedAt) : Number.NaN;
  const toRecordedAt = to.recordedAt ? Date.parse(to.recordedAt) : Number.NaN;
  let differenceMs: number;

  if (Number.isFinite(fromRecordedAt) && Number.isFinite(toRecordedAt)) {
    differenceMs = toRecordedAt - fromRecordedAt;
  } else {
    const fromMinutes = timestampMinutes(from.timestamp);
    let toMinutes = timestampMinutes(to.timestamp);
    if (toMinutes < fromMinutes) toMinutes += 24 * 60;
    differenceMs = (toMinutes - fromMinutes) * 60_000;
  }

  return differenceMs > 0 && differenceMs <= MAX_TRACK_POINT_GAP_MS;
}

function timestampMinutes(timestamp: string): number {
  const [hours = 0, minutes = 0, seconds = 0] = timestamp.split(':').map(Number);
  return hours * 60 + minutes + seconds / 60;
}

const TRACK_COLORS = {
  green: '#22c55e',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  critical: '#111827',
} as const;

const TRACK_EVENT_TYPES = [
  'stop',
  'refuel',
  'speeding',
  'fine',
  'connection-loss',
  'geofence-enter',
  'geofence-exit',
  'harsh-acceleration',
  'harsh-braking',
] as const satisfies readonly VehicleTrackEventView['type'][];

const TRACK_EVENT_ICON_PATTERNS: Record<VehicleTrackEventView['type'], readonly string[]> = {
  stop: ['11111', '10001', '10001', '10001', '11111'],
  refuel: ['11100', '10100', '11110', '10101', '11111'],
  speeding: ['00110', '01100', '11110', '00110', '01100'],
  fine: ['11111', '10101', '11111', '10001', '11111'],
  'connection-loss': ['10001', '01010', '00100', '01010', '10001'],
  'geofence-enter': ['00100', '00110', '11111', '00110', '00100'],
  'geofence-exit': ['00100', '01100', '11111', '01100', '00100'],
  'harsh-acceleration': ['00100', '01110', '10101', '00100', '00100'],
  'harsh-braking': ['00100', '00100', '10101', '01110', '00100'],
};

interface TrackSegmentProperties {
  id: string;
  color: (typeof TRACK_COLORS)[keyof typeof TRACK_COLORS];
  opacity: 0.72;
  fromTimestamp: string;
  toTimestamp: string;
  speedKph: number;
  address: string;
  tripId: string;
  tripIndex: number;
}

interface TrackEventProperties {
  speedColor: string;
  speedLabel: string;
  eventColor: string;
  metricLabel: string;
  id: string;
  type: VehicleTrackEventView['type'];
  title: string;
  count: number;
  tripId: string;
  tripIndex: number;
  icon: string;
}

type TrackEventWithCount = VehicleTrackEventView & { count?: number };

export interface MountVehicleTrackLayersOptions {
  trackViewModel: VehicleTrackPeriodViewModel;
  selectedEventId: string | null;
  onSegmentPreview: (segment: VehicleTrackSegment | null) => void;
  onEventPreview: (event: VehicleTrackEventView | null) => void;
  onEventActivate: (event: VehicleTrackEventView) => void;
}

interface VehicleTrackDataSurfaceProps {
  trackViewModel: VehicleTrackPeriodViewModel;
  ready: boolean;
}

export function VehicleTrackDataSurface({ trackViewModel, ready }: VehicleTrackDataSurfaceProps) {
  return (
    <div
      data-testid="vehicle-track-a11y"
      data-track-date={trackViewModel.date}
      data-track-period={trackViewModel.period}
      data-trip-count={trackViewModel.trips.length}
      data-track-ready={String(ready)}
      className="pointer-events-none absolute size-px overflow-hidden border-0 p-0 whitespace-nowrap [clip-path:inset(50%)] [clip:rect(0,0,0,0)]"
      aria-label={
        trackViewModel.period === 'seven-days'
          ? `Маршруты за 7 дней, ${trackViewModel.trips.length} поездки`
          : `Маршрут за ${trackViewModel.date}`
      }
      aria-hidden="true"
    >
      {trackViewModel.segments.map((segment) => (
        <span
          key={segment.id}
          data-track-color={segment.color}
          data-trip-id={segment.tripId}
          data-trip-index={segment.tripIndex}
          data-segment-id={segment.id}
          data-coordinate={serializeCoordinates(segment.to.coordinates)}
          data-from-coordinate={serializeCoordinates(segment.from.coordinates)}
          data-to-coordinate={serializeCoordinates(segment.to.coordinates)}
          style={{ opacity: segment.opacity }}
        />
      ))}
      {trackViewModel.eventGroups.map((event) => (
        <span
          key={event.id}
          data-coordinate={serializeCoordinates(event.coordinates)}
          data-trip-id={event.tripId}
        />
      ))}
      {trackViewModel.trips.flatMap((trip) => [
        <span
          key={`${trip.tripId}-start`}
          data-endpoint="start"
          data-trip-id={trip.tripId}
          data-coordinate={serializeCoordinates(trip.start.coordinates)}
        />,
        <span
          key={`${trip.tripId}-finish`}
          data-endpoint="finish"
          data-trip-id={trip.tripId}
          data-coordinate={serializeCoordinates(trip.finish.coordinates)}
        />,
      ])}
    </div>
  );
}

export function trackSegmentsToGeoJson(
  segments: readonly VehicleTrackSegment[],
): FeatureCollection<LineString, TrackSegmentProperties> {
  return {
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      id: segment.id,
      geometry: {
        type: 'LineString',
        coordinates: smoothSegmentCoordinates(segment, segments),
      },
      properties: {
        id: segment.id,
        color: TRACK_COLORS[segment.color],
        opacity: segment.opacity,
        fromTimestamp: segment.from.timestamp,
        toTimestamp: segment.to.timestamp,
        speedKph: segment.speedKph,
        address: segment.to.address,
        tripId: segment.tripId,
        tripIndex: segment.tripIndex,
      },
    })),
  };
}

/**
 * Adds a few Catmull–Rom samples to each GPS interval. The original endpoints
 * are preserved exactly, while the line follows a smooth tangent into/out of
 * adjacent intervals instead of rendering a visible chain of sticks.
 */
function smoothSegmentCoordinates(
  segment: VehicleTrackSegment,
  segments: readonly VehicleTrackSegment[],
): number[][] {
  const tripSegments = segments
    .filter((candidate) => candidate.tripId === segment.tripId)
    .sort((left, right) => left.from.timestamp.localeCompare(right.from.timestamp));
  const index = tripSegments.findIndex((candidate) => candidate.id === segment.id);
  const previous = index > 0 ? tripSegments[index - 1].from.coordinates : segment.from.coordinates;
  const next =
    index >= 0 && index < tripSegments.length - 1
      ? tripSegments[index + 1].to.coordinates
      : segment.to.coordinates;
  const from = segment.from.coordinates;
  const to = segment.to.coordinates;
  const samples = 6;
  const coordinates: number[][] = [];

  for (let sample = 0; sample <= samples; sample += 1) {
    const t = sample / samples;
    const t2 = t * t;
    const t3 = t2 * t;
    // Centripetal-style Catmull–Rom approximation with a conservative tension.
    const blend = (p0: number, p1: number, p2: number, p3: number) =>
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t * 0.7 +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 * 0.7 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3 * 0.7);
    coordinates.push([
      blend(previous[0], from[0], to[0], next[0]),
      blend(previous[1], from[1], to[1], next[1]),
    ]);
  }

  coordinates[0] = [...from];
  coordinates[coordinates.length - 1] = [...to];
  return coordinates;
}

export function trackEventsToGeoJson(
  events: readonly TrackEventWithCount[],
): FeatureCollection<Point, TrackEventProperties> {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      id: event.id,
      geometry: {
        type: 'Point',
        coordinates: [...event.coordinates],
      },
      properties: {
        id: event.id,
        type: event.type,
        title: event.title,
        count: event.count ?? 1,
        tripId: event.tripId,
        tripIndex: event.tripIndex,
        icon: getTrackEventIconId(event.type),
        speedColor: trackSpeedColor(event.speedKph),
        speedLabel: `${event.speedKph} км/ч`,
        eventColor: getTrackEventColor(event.type),
        metricLabel:
          event.type === 'harsh-acceleration' || event.type === 'harsh-braking'
            ? (event.metricLabel ?? '')
            : event.type === 'speeding'
              ? String(Math.round(event.speedKph))
              : '',
      },
    })),
  };
}

export function shouldAnimateTrackEventPulse(
  reducedMotion: boolean,
  visibilityState: DocumentVisibilityState,
): boolean {
  return !reducedMotion && visibilityState !== 'hidden';
}

export function mountVehicleTrackLayers(
  map: Map,
  options: MountVehicleTrackLayersOptions,
): () => void {
  if (!hasMapStyle(map)) return () => {};

  const { trackViewModel } = options;
  const segmentsById = new globalThis.Map(
    trackViewModel.segments.map((segment) => [segment.id, segment]),
  );
  const eventGroupsById = new globalThis.Map(
    trackViewModel.eventGroups.map((event) => [event.id, event]),
  );
  const addedImageIds: string[] = [];
  const gradientLayerIds: string[] = [];
  const gradientSourceIds: string[] = [];
  let hoveredSegmentId: string | null = null;
  let hoveredEventId: string | null = null;
  let pulseFrameId: number | null = null;
  let pulseTimerId: number | null = null;
  let pulseVisibilityListenerAttached = false;

  const reducedMotion =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  const stopPulse = () => {
    if (typeof window === 'undefined') return;
    if (pulseFrameId !== null) {
      window.cancelAnimationFrame(pulseFrameId);
      pulseFrameId = null;
    }
    if (pulseTimerId !== null) {
      window.clearTimeout(pulseTimerId);
      pulseTimerId = null;
    }
  };

  const animatePulse = () => {
    pulseFrameId = null;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    try {
      if (hasMapStyle(map) && map.getLayer('vehicle-track-event-pulse')) {
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-radius-transition', {
          duration: 1_650,
          delay: 0,
        });
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-opacity-transition', {
          duration: 1_650,
          delay: 0,
        });
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-radius', 23);
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-opacity', 0);
      }
    } catch {
      return;
    }

    if (typeof window !== 'undefined') {
      pulseTimerId = window.setTimeout(() => {
        pulseTimerId = null;
        startPulse();
      }, 2_100);
    }
  };

  const startPulse = () => {
    if (
      pulseFrameId !== null ||
      pulseTimerId !== null ||
      typeof window === 'undefined' ||
      !shouldAnimateTrackEventPulse(
        reducedMotion,
        typeof document === 'undefined' ? 'visible' : document.visibilityState,
      )
    ) {
      return;
    }

    try {
      if (hasMapStyle(map) && map.getLayer('vehicle-track-event-pulse')) {
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-radius-transition', {
          duration: 0,
          delay: 0,
        });
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-opacity-transition', {
          duration: 0,
          delay: 0,
        });
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-radius', 14);
        map.setPaintProperty('vehicle-track-event-pulse', 'circle-opacity', 0.22);
      }
    } catch {
      return;
    }

    pulseFrameId = window.requestAnimationFrame(animatePulse);
  };

  const handleVisibilityChange = () => {
    if (shouldAnimateTrackEventPulse(reducedMotion, document.visibilityState)) startPulse();
    else stopPulse();
  };

  const handleSegmentMove = (event: MapLayerMouseEvent) => {
    const featureId = getFeatureId(event);
    const segment = featureId ? segmentsById.get(featureId) : null;

    if (!featureId || !segment) return;

    if (hoveredSegmentId !== featureId) {
      clearFeatureState(map, TRACK_SOURCE_ID, hoveredSegmentId, 'hover');
      map.setFeatureState({ source: TRACK_SOURCE_ID, id: featureId }, { hover: true });
      hoveredSegmentId = featureId;
    }

    map.getCanvas().style.cursor = 'pointer';
    options.onSegmentPreview(segment);
  };

  const handleSegmentLeave = () => {
    clearFeatureState(map, TRACK_SOURCE_ID, hoveredSegmentId, 'hover');
    hoveredSegmentId = null;
    map.getCanvas().style.cursor = '';
    options.onSegmentPreview(null);
  };

  const handleEventMove = (event: MapLayerMouseEvent) => {
    const featureId = getFeatureId(event);
    const trackEvent = featureId ? eventGroupsById.get(featureId) : null;
    if (!featureId || !trackEvent) return;

    if (hoveredEventId !== featureId) {
      clearFeatureState(map, TRACK_EVENTS_SOURCE_ID, hoveredEventId, 'hover');
      map.setFeatureState({ source: TRACK_EVENTS_SOURCE_ID, id: featureId }, { hover: true });
      hoveredEventId = featureId;
    }

    map.getCanvas().style.cursor = 'pointer';
    options.onEventPreview(trackEvent);
  };

  const handleEventLeave = () => {
    clearFeatureState(map, TRACK_EVENTS_SOURCE_ID, hoveredEventId, 'hover');
    hoveredEventId = null;
    map.getCanvas().style.cursor = '';
    options.onEventPreview(null);
  };

  const handleEventClick = (event: MapLayerMouseEvent) => {
    const featureId = getFeatureId(event);
    const trackEvent = featureId ? eventGroupsById.get(featureId) : null;

    if (!trackEvent) return;

    options.onEventActivate(trackEvent);
  };

  const cleanup = () => {
    stopPulse();
    if (pulseVisibilityListenerAttached && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      pulseVisibilityListenerAttached = false;
    }

    map.off('mousemove', 'vehicle-track-hitbox', handleSegmentMove);
    map.off('mouseleave', 'vehicle-track-hitbox', handleSegmentLeave);
    map.off('mousemove', 'vehicle-track-event-hitbox', handleEventMove);
    map.off('mouseleave', 'vehicle-track-event-hitbox', handleEventLeave);
    map.off('click', 'vehicle-track-event-hitbox', handleEventClick);

    if (hasMapStyle(map)) {
      try {
        for (const id of gradientLayerIds) if (map.getLayer(id)) map.removeLayer(id);
        for (const id of gradientSourceIds) if (map.getSource(id)) map.removeSource(id);

        for (const layerId of TRACK_LAYER_IDS) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        }

        for (const imageId of addedImageIds) {
          map.removeImage(imageId);
        }

        for (const sourceId of TRACK_SOURCE_IDS) {
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      } catch {
        // MapLibre clears `style` during map removal. Cleanup is best-effort
        // because the destroyed map owns no reusable layer resources.
      }
    }
    addedImageIds.length = 0;

    try {
      map.getCanvas().style.cursor = '';
      const container = map.getContainer();
      delete container.dataset.trackCasingWidth;
      delete container.dataset.trackLineOffset;
    } catch {
      // The canvas/container may already be detached together with the map.
    }
  };

  try {
    const markerTheme =
      typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
        ? 'light'
        : 'dark';
    const segmentData = trackSegmentsToGeoJson(trackViewModel.segments);
    map.addSource(TRACK_SOURCE_ID, {
      type: 'geojson',
      data: segmentData,
    });
    map.addSource(TRACK_EVENTS_SOURCE_ID, {
      type: 'geojson',
      promoteId: 'id',
      data: trackEventsToGeoJson(trackViewModel.eventGroups),
    });
    map.addSource(TRACK_ENDPOINTS_SOURCE_ID, {
      type: 'geojson',
      data: endpointsToGeoJson(trackViewModel),
    });
    map.addSource(TRACK_PLAYBACK_SOURCE_ID, {
      type: 'geojson',
      data: EMPTY_PLAYBACK_TRAIL,
    });

    for (const kind of ['start', 'finish'] as const) {
      const imageId = getTrackEndpointIconId(kind);
      map.addImage(imageId, createTrackEndpointIconImage(kind, markerTheme), { pixelRatio: 2 });
      addedImageIds.push(imageId);
    }

    for (const type of TRACK_EVENT_TYPES) {
      const imageId = getTrackEventIconId(type);
      map.addImage(imageId, createTrackEventIconImage(type, markerTheme), { pixelRatio: 2 });
      addedImageIds.push(imageId);
    }

    map.addLayer({
      id: 'vehicle-track-casing',
      type: 'line',
      source: TRACK_SOURCE_ID,
      paint: {
        'line-color': '#ffffff',
        'line-opacity': 0.9,
        'line-width': 8,
        'line-offset': getTripLineOffsetExpression(),
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    const gradientRuns = buildTrackGradientRuns(
      trackViewModel.segments,
      segmentData.features.map((feature) => feature.geometry.coordinates),
    );
    gradientRuns.forEach((run, index) => {
      const id = `vehicle-track-gradient-${index}`;
      map.addSource(id, {
        type: 'geojson',
        lineMetrics: true,
        tolerance: 0,
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: run.coordinates },
        },
      });
      gradientSourceIds.push(id);
      map.addLayer({
        id,
        type: 'line',
        source: id,
        paint: {
          'line-gradient': run.gradient,
          'line-width': 5,
          'line-opacity': 0.72,
          'line-offset': run.tripIndex === 1 ? -5 : run.tripIndex === 2 ? 5 : 0,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
      gradientLayerIds.push(id);
    });
    map.addLayer({
      id: 'vehicle-track-lines',
      type: 'line',
      source: TRACK_SOURCE_ID,
      paint: {
        'line-color': '#ffffff',
        'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.2, 0],
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 7, 5],
        'line-offset': getTripLineOffsetExpression(),
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    map.addLayer({
      id: 'vehicle-track-playback',
      type: 'line',
      source: TRACK_PLAYBACK_SOURCE_ID,
      paint: {
        'line-color': '#0067ff',
        'line-opacity': 1,
        'line-width': 6,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    map.addLayer({
      id: 'vehicle-track-hitbox',
      type: 'line',
      source: TRACK_SOURCE_ID,
      paint: {
        'line-color': 'rgba(0, 0, 0, 0)',
        'line-width': 16,
        'line-offset': getTripLineOffsetExpression(),
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    map.addLayer({
      id: 'vehicle-track-directions',
      type: 'symbol',
      source: TRACK_SOURCE_ID,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 110,
        'text-field': '➤',
        'text-size': 13,
        'text-keep-upright': false,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#334155',
        'text-halo-width': 1,
      },
    });
    map.addLayer({
      id: 'vehicle-track-endpoints',
      type: 'symbol',
      source: TRACK_ENDPOINTS_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.62, 13, 0.78, 15, 1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.58, 13, 0.72, 15, 1],
      },
    });
    map.addLayer({
      id: 'vehicle-track-endpoint-labels',
      type: 'symbol',
      source: TRACK_ENDPOINTS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#111318',
        'text-halo-width': 2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, 0, 15, 1],
      },
    });
    map.addLayer({
      id: 'vehicle-track-events',
      type: 'circle',
      source: TRACK_EVENTS_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 3],
        'circle-color': ['get', 'eventColor'],
        'circle-stroke-color': markerTheme === 'dark' ? '#343438' : '#f8fafc',
        'circle-stroke-width': 1,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.58, 13, 0.72, 15, 1],
      },
    });
    map.addLayer({
      id: 'vehicle-track-event-icons',
      type: 'symbol',
      source: TRACK_EVENTS_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.58, 13, 0.72, 15, 1],
        'icon-offset': [0, 0],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.58, 13, 0.72, 15, 1],
      },
    });
    map.addLayer(
      {
        id: 'vehicle-track-event-pulse',
        type: 'circle',
        source: TRACK_EVENTS_SOURCE_ID,
        paint: {
          'circle-color': ['get', 'eventColor'],
          'circle-radius': 14,
          'circle-opacity': reducedMotion ? 0 : 0.22,
          'circle-stroke-width': 0,
        },
      },
      'vehicle-track-event-icons',
    );
    map.addLayer({
      id: 'vehicle-track-event-metrics',
      type: 'symbol',
      source: TRACK_EVENTS_SOURCE_ID,
      filter: [
        'in',
        ['get', 'type'],
        ['literal', ['speeding', 'harsh-acceleration', 'harsh-braking']],
      ],
      layout: {
        'text-field': ['get', 'metricLabel'],
        'text-size': 12,
        'text-offset': [1.55, 0],
        'text-anchor': 'left',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': ['get', 'eventColor'],
        'text-halo-width': 3,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, 0, 15, 1],
      },
    });
    map.addLayer({
      id: 'vehicle-track-event-counts',
      type: 'symbol',
      source: TRACK_EVENTS_SOURCE_ID,
      layout: {
        'text-field': ['case', ['>', ['get', 'count'], 1], ['to-string', ['get', 'count']], ''],
        'text-size': 11,
        'text-offset': [0, -2],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
      },
    });
    map.addLayer({
      id: 'vehicle-track-event-hitbox',
      type: 'circle',
      source: TRACK_EVENTS_SOURCE_ID,
      paint: {
        'circle-radius': 28,
        'circle-color': 'rgba(0, 0, 0, 0)',
      },
    });

    for (const event of trackViewModel.eventGroups) {
      map.setFeatureState(
        { source: TRACK_EVENTS_SOURCE_ID, id: event.id },
        { selected: event.id === options.selectedEventId },
      );
    }

    map.on('mousemove', 'vehicle-track-hitbox', handleSegmentMove);
    map.on('mouseleave', 'vehicle-track-hitbox', handleSegmentLeave);
    map.on('mousemove', 'vehicle-track-event-hitbox', handleEventMove);
    map.on('mouseleave', 'vehicle-track-event-hitbox', handleEventLeave);
    map.on('click', 'vehicle-track-event-hitbox', handleEventClick);

    if (!reducedMotion && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      pulseVisibilityListenerAttached = true;
      startPulse();
    }

    const container = map.getContainer();
    container.dataset.trackCasingWidth = JSON.stringify(
      map.getPaintProperty('vehicle-track-casing', 'line-width'),
    );
    container.dataset.trackLineOffset = JSON.stringify(
      map.getPaintProperty('vehicle-track-lines', 'line-offset'),
    );
  } catch (error) {
    cleanup();
    throw error;
  }

  return cleanup;
}

function hasMapStyle(map: Map): boolean {
  try {
    return typeof map.isStyleLoaded() === 'boolean';
  } catch {
    return false;
  }
}

function endpointsToGeoJson(
  track: VehicleTrackPeriodViewModel,
): FeatureCollection<
  Point,
  { kind: 'start' | 'finish'; label: string; icon: string; tripId: string }
> {
  const features = track.trips.flatMap((trip) => {
    const dateLabel = trip.date.split('-').reverse().slice(0, 2).join('.');

    return [
      {
        type: 'Feature' as const,
        id: `${trip.tripId}-start`,
        geometry: { type: 'Point' as const, coordinates: [...trip.start.coordinates] },
        properties: {
          kind: 'start' as const,
          label: track.trips.length > 1 ? `СТАРТ ${dateLabel}` : 'СТАРТ',
          icon: getTrackEndpointIconId('start'),
          tripId: trip.tripId,
        },
      },
      {
        type: 'Feature' as const,
        id: `${trip.tripId}-finish`,
        geometry: { type: 'Point' as const, coordinates: [...trip.finish.coordinates] },
        properties: {
          kind: 'finish' as const,
          label: track.trips.length > 1 ? `ФИНИШ ${dateLabel}` : 'ФИНИШ',
          icon: getTrackEndpointIconId('finish'),
          tripId: trip.tripId,
        },
      },
    ];
  });

  return { type: 'FeatureCollection', features };
}

function getTripLineOffsetExpression(): ExpressionSpecification {
  return ['match', ['get', 'tripIndex'], 1, -5, 2, 5, 0];
}

export function getTrackEventIconId(type: VehicleTrackEventView['type']): string {
  return `vehicle-track-event-${type}`;
}

export function getTrackEndpointIconId(kind: 'start' | 'finish'): string {
  return `vehicle-track-endpoint-${kind}`;
}

export function createTrackEndpointIconImage(
  kind: 'start' | 'finish',
  theme: 'light' | 'dark' = 'dark',
): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const width = 56;
  const height = 56;
  const data = new Uint8Array(width * height * 4);
  const center = 27.5;
  const surface = getMarkerSurface(theme);
  const accent =
    kind === 'start'
      ? ([22, 163, 74, 255] as const)
      : theme === 'dark'
        ? ([255, 255, 255, 255] as const)
        : ([17, 19, 24, 255] as const);

  drawCircle(data, width, center, center, 27.5, accent);
  drawCircle(data, width, center, center, 23.5, surface);

  if (kind === 'start') {
    drawCircle(data, width, center, center, 10, accent);
    drawCircle(data, width, center, center, 6, surface);
    drawCircle(data, width, center, center, 2.5, accent);
  } else {
    const flagLight = [255, 255, 255, 255] as const;
    const flagDark = [49, 54, 64, 255] as const;
    drawLine(data, width, [18, 16], [18, 41], 3, accent);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const color = (row + column) % 2 === 0 ? flagLight : flagDark;
        for (let y = 17 + row * 5; y < 22 + row * 5; y += 1) {
          for (let x = 20 + column * 4; x < 24 + column * 4; x += 1) {
            setIconPixel(data, width, x, y, color);
          }
        }
      }
    }
  }

  return { width, height, data };
}

export function createTrackEventIconImage(
  type: VehicleTrackEventView['type'],
  theme: 'light' | 'dark' = 'dark',
): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const width = 56;
  const height = 56;
  const data = new Uint8Array(width * height * 4);
  const color = getEventIconColor(type);
  const center = 27.5;

  drawCircle(data, width, center, center, 27.5, color);
  drawCircle(data, width, center, center, 23.5, getMarkerSurface(theme));

  if (type === 'speeding') {
    drawSpeedometerGlyph(data, width, color);
  } else if (type === 'harsh-acceleration') {
    drawDoubleChevronGlyph(data, width, 'up', color);
  } else if (type === 'harsh-braking') {
    drawDoubleChevronGlyph(data, width, 'down', color);
  } else if (type === 'connection-loss') {
    drawConnectionLossGlyph(data, width, color);
  } else {
    drawPatternGlyph(data, width, TRACK_EVENT_ICON_PATTERNS[type], color);
  }

  return { width, height, data };
}

type Rgba = readonly [number, number, number, number];

function getMarkerSurface(theme: 'light' | 'dark'): Rgba {
  return theme === 'dark' ? [23, 23, 28, 255] : [248, 250, 252, 255];
}

function drawSpeedometerGlyph(data: Uint8Array, width: number, color: Rgba) {
  drawArc(data, width, 28, 32, 12, Math.PI, Math.PI * 2, 2.5, color);
  drawLine(data, width, [28, 32], [36, 24], 2.5, color);
  drawCircle(data, width, 28, 32, 2.5, color);
}

function drawDoubleChevronGlyph(
  data: Uint8Array,
  width: number,
  direction: 'up' | 'down',
  color: Rgba,
) {
  const rows = [23, 33];
  for (const row of rows) {
    if (direction === 'up') {
      drawLine(data, width, [19, row + 5], [28, row - 4], 3, color);
      drawLine(data, width, [28, row - 4], [37, row + 5], 3, color);
    } else {
      drawLine(data, width, [19, row - 4], [28, row + 5], 3, color);
      drawLine(data, width, [28, row + 5], [37, row - 4], 3, color);
    }
  }
}

function drawConnectionLossGlyph(data: Uint8Array, width: number, color: Rgba) {
  drawArc(data, width, 28, 34, 13, Math.PI * 1.18, Math.PI * 1.82, 2.5, color);
  drawArc(data, width, 28, 34, 8, Math.PI * 1.18, Math.PI * 1.82, 2.5, color);
  drawCircle(data, width, 28, 34, 2.5, color);
  drawLine(data, width, [18, 17], [39, 39], 3, color);
}

function drawPatternGlyph(
  data: Uint8Array,
  width: number,
  pattern: readonly string[],
  color: Rgba,
) {
  const cellSize = 5;
  const start = 15;
  pattern.forEach((row, rowIndex) => {
    [...row].forEach((pixel, columnIndex) => {
      if (pixel !== '1') return;
      for (let offsetY = 0; offsetY < cellSize; offsetY += 1) {
        for (let offsetX = 0; offsetX < cellSize; offsetX += 1) {
          setIconPixel(
            data,
            width,
            start + columnIndex * cellSize + offsetX,
            start + rowIndex * cellSize + offsetY,
            color,
          );
        }
      }
    });
  });
}

function drawArc(
  data: Uint8Array,
  width: number,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  thickness: number,
  color: Rgba,
) {
  const steps = Math.max(12, Math.ceil(radius * Math.abs(endAngle - startAngle)));
  let previous: readonly [number, number] = [
    centerX + Math.cos(startAngle) * radius,
    centerY + Math.sin(startAngle) * radius,
  ];
  for (let index = 1; index <= steps; index += 1) {
    const angle = startAngle + ((endAngle - startAngle) * index) / steps;
    const next: readonly [number, number] = [
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    ];
    drawLine(data, width, previous, next, thickness, color);
    previous = next;
  }
}

function drawLine(
  data: Uint8Array,
  width: number,
  from: readonly [number, number],
  to: readonly [number, number],
  thickness: number,
  color: Rgba,
) {
  const minX = Math.max(0, Math.floor(Math.min(from[0], to[0]) - thickness));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(from[0], to[0]) + thickness));
  const minY = Math.max(0, Math.floor(Math.min(from[1], to[1]) - thickness));
  const maxY = Math.min(width - 1, Math.ceil(Math.max(from[1], to[1]) + thickness));
  const segmentX = to[0] - from[0];
  const segmentY = to[1] - from[1];
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const projection =
        segmentLengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((x - from[0]) * segmentX + (y - from[1]) * segmentY) / segmentLengthSquared,
              ),
            );
      const nearestX = from[0] + projection * segmentX;
      const nearestY = from[1] + projection * segmentY;
      if (Math.hypot(x - nearestX, y - nearestY) <= thickness / 2) {
        setIconPixel(data, width, x, y, color);
      }
    }
  }
}

function drawCircle(
  data: Uint8Array,
  width: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: Rgba,
) {
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(width - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius ** 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSquared) {
        setIconPixel(data, width, x, y, color);
      }
    }
  }
}

function getEventIconColor(
  type: VehicleTrackEventView['type'],
): readonly [number, number, number, number] {
  if (type === 'speeding') return [239, 68, 68, 255];
  if (type === 'harsh-acceleration') return [245, 158, 11, 255];
  if (type === 'harsh-braking') return [0, 103, 255, 255];
  if (type === 'fine') return [124, 58, 237, 255];
  if (type === 'connection-loss') return [146, 146, 156, 255];
  if (type === 'refuel') return [37, 99, 235, 255];
  if (type === 'stop') return [245, 158, 11, 255];
  if (type === 'geofence-enter') return [22, 163, 74, 255];
  return [124, 58, 237, 255];
}

function getTrackEventColor(type: VehicleTrackEventView['type']): string {
  if (type === 'speeding') return '#ef4444';
  if (type === 'harsh-acceleration') return '#f59e0b';
  if (type === 'harsh-braking') return '#0067ff';
  if (type === 'fine') return '#7c3aed';
  if (type === 'connection-loss') return '#92929c';
  if (type === 'refuel') return '#2563eb';
  if (type === 'stop') return '#f59e0b';
  return '#8b5cf6';
}

function setIconPixel(
  data: Uint8Array,
  width: number,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
) {
  const index = (y * width + x) * 4;
  data[index] = color[0];
  data[index + 1] = color[1];
  data[index + 2] = color[2];
  data[index + 3] = color[3];
}

function getFeatureId(event: MapLayerMouseEvent): string | null {
  const id = event.features?.[0]?.id;
  return id === undefined ? null : String(id);
}

function serializeCoordinates(coordinates: TrackCoordinates): string {
  return JSON.stringify(coordinates);
}

function clearFeatureState(
  map: Map,
  source: string,
  id: string | null,
  state: 'hover' | 'selected',
) {
  if (id === null) return;
  map.setFeatureState({ source, id }, { [state]: false });
}
