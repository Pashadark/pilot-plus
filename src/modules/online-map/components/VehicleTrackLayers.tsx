import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Map, MapLayerMouseEvent } from 'maplibre-gl';

import type {
  TrackCoordinates,
  VehicleTrackEventView,
  VehicleTrackSegment,
  VehicleTrackViewModel,
} from '../track-types';

const TRACK_SOURCE_ID = 'vehicle-track';
const TRACK_EVENTS_SOURCE_ID = 'vehicle-track-events';
const TRACK_ENDPOINTS_SOURCE_ID = 'vehicle-track-endpoints';

const TRACK_LAYER_IDS = [
  'vehicle-track-event-hitbox',
  'vehicle-track-event-counts',
  'vehicle-track-events',
  'vehicle-track-endpoint-labels',
  'vehicle-track-endpoints',
  'vehicle-track-directions',
  'vehicle-track-hitbox',
  'vehicle-track-lines',
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

interface TrackSegmentProperties {
  id: string;
  color: (typeof TRACK_COLORS)[keyof typeof TRACK_COLORS];
  opacity: 0.72;
  fromTimestamp: string;
  toTimestamp: string;
  speedKph: number;
  address: string;
}

interface TrackEventProperties {
  id: string;
  type: VehicleTrackEventView['type'];
  title: string;
  count: number;
}

type TrackEventWithCount = VehicleTrackEventView & { count?: number };

export interface MountVehicleTrackLayersOptions {
  trackViewModel: VehicleTrackViewModel;
  selectedEventId: string | null;
  onSegmentHover: (segment: VehicleTrackSegment, coordinates: TrackCoordinates) => void;
  onSegmentLeave: () => void;
  onEventSelect: (event: VehicleTrackEventView, count: number) => void;
  onPlaybackProgressRequest: (event: VehicleTrackEventView) => void;
}

interface VehicleTrackAccessibilitySurfaceProps extends Pick<
  MountVehicleTrackLayersOptions,
  | 'trackViewModel'
  | 'onSegmentHover'
  | 'onSegmentLeave'
  | 'onEventSelect'
  | 'onPlaybackProgressRequest'
> {
  ready: boolean;
  onPlaybackPointRequest: (progress: number) => void;
}

export function VehicleTrackAccessibilitySurface({
  trackViewModel,
  ready,
  onSegmentHover,
  onSegmentLeave,
  onEventSelect,
  onPlaybackProgressRequest,
  onPlaybackPointRequest,
}: VehicleTrackAccessibilitySurfaceProps) {
  return (
    <div
      data-testid="vehicle-track-a11y"
      data-track-date={trackViewModel.date}
      data-track-ready={String(ready)}
      className="absolute top-0 left-0 z-10 h-2 w-24 overflow-hidden whitespace-nowrap"
      aria-label={`Маршрут за ${trackViewModel.date}`}
    >
      {trackViewModel.segments.map((segment, index) => (
        <button
          key={segment.id}
          type="button"
          data-track-color={segment.color}
          data-coordinate={serializeCoordinates(segment.to.coordinates)}
          data-from-coordinate={serializeCoordinates(segment.from.coordinates)}
          data-to-coordinate={serializeCoordinates(segment.to.coordinates)}
          aria-label={`Участок маршрута ${segment.from.timestamp}–${segment.to.timestamp}`}
          className="absolute top-0 size-2 border-0 bg-transparent p-0"
          style={{ left: index * 8, opacity: segment.opacity }}
          disabled={!ready}
          onMouseEnter={() => onSegmentHover(segment, segment.to.coordinates)}
          onMouseLeave={onSegmentLeave}
          onFocus={() => onSegmentHover(segment, segment.to.coordinates)}
          onBlur={onSegmentLeave}
        />
      ))}
      {trackViewModel.eventGroups.map((event, index) => (
        <button
          key={event.id}
          type="button"
          data-coordinate={serializeCoordinates(event.coordinates)}
          aria-label={`Событие: ${event.title}`}
          className="absolute top-0 size-2 border-0 bg-transparent p-0"
          style={{ left: (trackViewModel.segments.length + index) * 8 }}
          disabled={!ready}
          onClick={() => {
            onEventSelect(event, event.count);
            onPlaybackProgressRequest(event);
          }}
        />
      ))}
      <button
        type="button"
        data-coordinate={serializeCoordinates(trackViewModel.start.coordinates)}
        aria-label="Начало маршрута"
        className="absolute top-0 size-2 border-0 bg-transparent p-0"
        style={{
          left: (trackViewModel.segments.length + trackViewModel.eventGroups.length) * 8,
        }}
        disabled={!ready}
        onClick={() => onPlaybackPointRequest(0)}
      />
      <button
        type="button"
        data-coordinate={serializeCoordinates(trackViewModel.finish.coordinates)}
        aria-label="Конец маршрута"
        className="absolute top-0 size-2 border-0 bg-transparent p-0"
        style={{
          left: (trackViewModel.segments.length + trackViewModel.eventGroups.length + 1) * 8,
        }}
        disabled={!ready}
        onClick={() => onPlaybackPointRequest(100)}
      />
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
    options.onSegmentHover(segment, event.lngLat.toArray() as TrackCoordinates);
  };

  const handleSegmentLeave = () => {
    clearFeatureState(map, TRACK_SOURCE_ID, hoveredSegmentId, 'hover');
    hoveredSegmentId = null;
    map.getCanvas().style.cursor = '';
    options.onSegmentLeave();
  };

  const handleEventMove = (event: MapLayerMouseEvent) => {
    const featureId = getFeatureId(event);
    if (!featureId) return;

    if (hoveredEventId !== featureId) {
      clearFeatureState(map, TRACK_EVENTS_SOURCE_ID, hoveredEventId, 'hover');
      map.setFeatureState({ source: TRACK_EVENTS_SOURCE_ID, id: featureId }, { hover: true });
      hoveredEventId = featureId;
    }

    map.getCanvas().style.cursor = 'pointer';
  };

  const handleEventLeave = () => {
    clearFeatureState(map, TRACK_EVENTS_SOURCE_ID, hoveredEventId, 'hover');
    hoveredEventId = null;
    map.getCanvas().style.cursor = '';
  };

  const handleEventClick = (event: MapLayerMouseEvent) => {
    const featureId = getFeatureId(event);
    const trackEvent = featureId ? eventGroupsById.get(featureId) : null;

    if (!trackEvent) return;

    options.onEventSelect(trackEvent, trackEvent.count);
    options.onPlaybackProgressRequest(trackEvent);
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

    for (const sourceId of TRACK_SOURCE_IDS) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }

    map.getCanvas().style.cursor = '';
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

    map.addLayer({
      id: 'vehicle-track-lines',
      type: 'line',
      source: TRACK_SOURCE_ID,
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.72],
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 7, 5],
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
  } catch (error) {
    cleanup();
    throw error;
  }

  return cleanup;
}

function endpointsToGeoJson(
  track: VehicleTrackViewModel,
): FeatureCollection<Point, { kind: 'start' | 'finish'; label: string; color: string }> {
  const features: Feature<Point, { kind: 'start' | 'finish'; label: string; color: string }>[] = [
    {
      type: 'Feature',
      id: 'start',
      geometry: { type: 'Point', coordinates: [...track.start.coordinates] },
      properties: { kind: 'start', label: 'Старт', color: '#22c55e' },
    },
    {
      type: 'Feature',
      id: 'finish',
      geometry: { type: 'Point', coordinates: [...track.finish.coordinates] },
      properties: { kind: 'finish', label: 'Финиш', color: '#2563eb' },
    },
  ];

  return { type: 'FeatureCollection', features };
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
