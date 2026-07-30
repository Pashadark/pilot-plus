import type { FeatureCollection, LineString, Point } from 'geojson';
import type { ExpressionSpecification, Map, MapLayerMouseEvent } from 'maplibre-gl';

import type {
  TrackCoordinates,
  VehicleTrackEventView,
  VehicleTrackPeriodViewModel,
  VehicleTrackSegment,
} from '../track-types';

const TRACK_SOURCE_ID = 'vehicle-track';
const TRACK_EVENTS_SOURCE_ID = 'vehicle-track-events';
const TRACK_ENDPOINTS_SOURCE_ID = 'vehicle-track-endpoints';

const TRACK_LAYER_IDS = [
  'vehicle-track-event-hitbox',
  'vehicle-track-event-counts',
  'vehicle-track-event-icons',
  'vehicle-track-events',
  'vehicle-track-endpoint-labels',
  'vehicle-track-endpoints',
  'vehicle-track-directions',
  'vehicle-track-hitbox',
  'vehicle-track-lines',
  'vehicle-track-casing',
] as const;

const TRACK_SOURCE_IDS = [
  TRACK_ENDPOINTS_SOURCE_ID,
  TRACK_EVENTS_SOURCE_ID,
  TRACK_SOURCE_ID,
] as const;

const TRACK_COLORS = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
} as const;

const TRACK_EVENT_TYPES = [
  'stop',
  'refuel',
  'speeding',
  'connection-loss',
  'geofence-enter',
  'geofence-exit',
] as const satisfies readonly VehicleTrackEventView['type'][];

const TRACK_EVENT_ICON_PATTERNS: Record<VehicleTrackEventView['type'], readonly string[]> = {
  stop: ['11111', '10001', '10001', '10001', '11111'],
  refuel: ['11100', '10100', '11110', '10101', '11111'],
  speeding: ['00110', '01100', '11110', '00110', '01100'],
  'connection-loss': ['10001', '01010', '00100', '01010', '10001'],
  'geofence-enter': ['00100', '00110', '11111', '00110', '00100'],
  'geofence-exit': ['00100', '01100', '11111', '01100', '00100'],
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
        coordinates: [[...segment.from.coordinates], [...segment.to.coordinates]],
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
      },
    })),
  };
}

export function mountVehicleTrackLayers(
  map: Map,
  options: MountVehicleTrackLayersOptions,
): () => void {
  const { trackViewModel } = options;
  const segmentsById = new globalThis.Map(
    trackViewModel.segments.map((segment) => [segment.id, segment]),
  );
  const eventGroupsById = new globalThis.Map(
    trackViewModel.eventGroups.map((event) => [event.id, event]),
  );
  const addedImageIds: string[] = [];
  let hoveredSegmentId: string | null = null;
  let hoveredEventId: string | null = null;

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
    map.off('mousemove', 'vehicle-track-hitbox', handleSegmentMove);
    map.off('mouseleave', 'vehicle-track-hitbox', handleSegmentLeave);
    map.off('mousemove', 'vehicle-track-event-hitbox', handleEventMove);
    map.off('mouseleave', 'vehicle-track-event-hitbox', handleEventLeave);
    map.off('click', 'vehicle-track-event-hitbox', handleEventClick);

    for (const layerId of TRACK_LAYER_IDS) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }

    for (const imageId of addedImageIds) {
      map.removeImage(imageId);
    }
    addedImageIds.length = 0;

    for (const sourceId of TRACK_SOURCE_IDS) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }

    map.getCanvas().style.cursor = '';
    const container = map.getContainer();
    delete container.dataset.trackCasingWidth;
    delete container.dataset.trackLineOffset;
  };

  try {
    map.addSource(TRACK_SOURCE_ID, {
      type: 'geojson',
      data: trackSegmentsToGeoJson(trackViewModel.segments),
    });
    map.addSource(TRACK_EVENTS_SOURCE_ID, {
      type: 'geojson',
      data: trackEventsToGeoJson(trackViewModel.eventGroups),
    });
    map.addSource(TRACK_ENDPOINTS_SOURCE_ID, {
      type: 'geojson',
      data: endpointsToGeoJson(trackViewModel),
    });

    for (const type of TRACK_EVENT_TYPES) {
      const imageId = getTrackEventIconId(type);
      map.addImage(imageId, createTrackEventIconImage(type), { pixelRatio: 2 });
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
    map.addLayer({
      id: 'vehicle-track-lines',
      type: 'line',
      source: TRACK_SOURCE_ID,
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.72],
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 7, 5],
        'line-offset': getTripLineOffsetExpression(),
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
      type: 'circle',
      source: TRACK_ENDPOINTS_SOURCE_ID,
      paint: {
        'circle-radius': 8,
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });
    map.addLayer({
      id: 'vehicle-track-endpoint-labels',
      type: 'symbol',
      source: TRACK_ENDPOINTS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 12,
        'text-offset': [0, 1.7],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#1f2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    });
    map.addLayer({
      id: 'vehicle-track-events',
      type: 'circle',
      source: TRACK_EVENTS_SOURCE_ID,
      paint: {
        'circle-radius': [
          'case',
          [
            'any',
            ['boolean', ['feature-state', 'hover'], false],
            ['boolean', ['feature-state', 'selected'], false],
          ],
          10,
          8,
        ],
        'circle-color': [
          'match',
          ['get', 'type'],
          'speeding',
          '#ef4444',
          'connection-loss',
          '#64748b',
          'refuel',
          '#2563eb',
          'stop',
          '#f59e0b',
          '#8b5cf6',
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });
    map.addLayer({
      id: 'vehicle-track-event-icons',
      type: 'symbol',
      source: TRACK_EVENTS_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 0.75,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
    map.addLayer({
      id: 'vehicle-track-event-counts',
      type: 'symbol',
      source: TRACK_EVENTS_SOURCE_ID,
      layout: {
        'text-field': ['case', ['>', ['get', 'count'], 1], ['to-string', ['get', 'count']], ''],
        'text-size': 11,
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
        'circle-radius': 22,
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

function endpointsToGeoJson(
  track: VehicleTrackPeriodViewModel,
): FeatureCollection<
  Point,
  { kind: 'start' | 'finish'; label: string; color: string; tripId: string }
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
          label: track.trips.length > 1 ? `Старт ${dateLabel}` : 'Старт',
          color: '#22c55e',
          tripId: trip.tripId,
        },
      },
      {
        type: 'Feature' as const,
        id: `${trip.tripId}-finish`,
        geometry: { type: 'Point' as const, coordinates: [...trip.finish.coordinates] },
        properties: {
          kind: 'finish' as const,
          label: track.trips.length > 1 ? `Финиш ${dateLabel}` : 'Финиш',
          color: '#2563eb',
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

export function createTrackEventIconImage(type: VehicleTrackEventView['type']): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const width = 24;
  const height = 24;
  const data = new Uint8Array(width * height * 4);
  const color = getEventIconColor(type);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x - 11.5) ** 2 + (y - 11.5) ** 2 <= 11 ** 2) {
        setIconPixel(data, width, x, y, color);
      }
    }
  }

  TRACK_EVENT_ICON_PATTERNS[type].forEach((row, rowIndex) => {
    [...row].forEach((pixel, columnIndex) => {
      if (pixel !== '1') return;
      for (let offsetY = 0; offsetY < 2; offsetY += 1) {
        for (let offsetX = 0; offsetX < 2; offsetX += 1) {
          setIconPixel(
            data,
            width,
            7 + columnIndex * 2 + offsetX,
            7 + rowIndex * 2 + offsetY,
            [255, 255, 255, 255],
          );
        }
      }
    });
  });

  return { width, height, data };
}

function getEventIconColor(
  type: VehicleTrackEventView['type'],
): readonly [number, number, number, number] {
  if (type === 'speeding') return [239, 68, 68, 255];
  if (type === 'connection-loss') return [71, 85, 105, 255];
  if (type === 'refuel') return [37, 99, 235, 255];
  if (type === 'stop') return [245, 158, 11, 255];
  if (type === 'geofence-enter') return [22, 163, 74, 255];
  return [124, 58, 237, 255];
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
