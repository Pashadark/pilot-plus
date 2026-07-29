// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { buildTrackViewModel, getVehicleTrack } from '../track-model';
import type { VehicleTrackViewModel } from '../track-types';
import type { OnlineMapVehicle } from '../types';
import { OnlineFleetMap } from './OnlineFleetMap';

const mapMocks = vi.hoisted(() => {
  const canvas = document.createElement('canvas');

  return {
    canvas,
    mapOff: vi.fn(),
    mapOnce: vi.fn(),
    mapOn: vi.fn(),
    mapRemove: vi.fn(),
    mapResize: vi.fn(),
    mapLoaded: vi.fn(() => true),
    mapGetLayer: vi.fn(),
    mapGetSource: vi.fn(),
    mapAddLayer: vi.fn(),
    mapAddSource: vi.fn(),
    mapRemoveLayer: vi.fn(),
    mapRemoveSource: vi.fn(),
    mapSetFeatureState: vi.fn(),
    mapFitBounds: vi.fn(),
    markerRemove: vi.fn(),
    popupRemove: vi.fn(),
  };
});

vi.mock('maplibre-gl', () => {
  class Map {
    getCanvas = vi.fn(() => mapMocks.canvas);
    addControl = vi.fn();
    once = mapMocks.mapOnce.mockImplementation(
      (_event: string, handler: () => void) => void window.setTimeout(handler, 0),
    );
    on = mapMocks.mapOn;
    off = mapMocks.mapOff;
    loaded = mapMocks.mapLoaded;
    resize = mapMocks.mapResize;
    remove = mapMocks.mapRemove;
    getLayer = mapMocks.mapGetLayer;
    getSource = mapMocks.mapGetSource;
    addLayer = mapMocks.mapAddLayer;
    addSource = mapMocks.mapAddSource;
    removeLayer = mapMocks.mapRemoveLayer;
    removeSource = mapMocks.mapRemoveSource;
    setFeatureState = mapMocks.mapSetFeatureState;
    fitBounds = mapMocks.mapFitBounds;
    flyTo = vi.fn();
  }

  class Marker {
    setLngLat() {
      return this;
    }

    addTo() {
      return this;
    }

    remove = mapMocks.markerRemove;
  }

  class Popup {
    setLngLat() {
      return this;
    }

    setDOMContent() {
      return this;
    }

    addTo() {
      return this;
    }

    remove = mapMocks.popupRemove;
  }

  return {
    default: {
      Map,
      Marker,
      Popup,
      NavigationControl: class NavigationControl {},
      LngLatBounds: class LngLatBounds {
        extend() {
          return this;
        }
      },
    },
  };
});

const vehicles: readonly OnlineMapVehicle[] = [
  {
    id: 'lada-vesta-a123mr77',
    name: 'Lada Vesta',
    plate: 'А 123 МР 77',
    status: 'moving',
    speedKph: 42,
    fuelPercent: 68,
    lastSeenLabel: 'сейчас',
    address: 'Красноярск, ул. Карла Маркса',
    latitude: 56.009,
    longitude: 92.851,
  },
];

function getTrackViewModel(vehicleId: string): VehicleTrackViewModel {
  const track = getVehicleTrack(vehicleId, '2026-07-29');

  if (!track) {
    throw new Error('Тестовый маршрут не найден');
  }

  return buildTrackViewModel(track);
}

beforeEach(() => {
  vi.clearAllMocks();
  mapMocks.mapLoaded.mockReturnValue(true);
  mapMocks.mapGetLayer.mockReturnValue({});
  mapMocks.mapGetSource.mockReturnValue({});
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('откладывает размонтирование вложенных React roots до завершения parent cleanup', () => {
  const source = readFileSync(
    resolve('src/modules/online-map/components/OnlineFleetMap.tsx'),
    'utf8',
  );

  expect(source).toContain('queueMicrotask(() => root.unmount())');
  expect(source).not.toContain('root.unmount();');
});

it('не пересоздаёт карту из-за нового массива с теми же данными автомобилей', () => {
  const source = readFileSync(
    resolve('src/modules/online-map/components/OnlineFleetMap.tsx'),
    'utf8',
  );

  expect(source).toContain('const vehiclesSnapshotKey = JSON.stringify(vehicles);');
  expect(source).toContain('[instanceKey, stableVehicles]');
  expect(source).not.toContain('[instanceKey, vehicles]');
});

it('удаляет обработчики, popup, источники и слои маршрута при смене автомобиля', async () => {
  const firstTrack = getTrackViewModel('lada-vesta-a123mr77');
  const secondTrack = getTrackViewModel('haval-jolion-v456kh178');
  const props = {
    vehicles,
    selectedVehicleId: vehicles[0].id,
    playbackPoint: firstTrack.start,
    selectedEventId: null,
    onVehicleSelect: vi.fn(),
    onEventSelect: vi.fn(),
    onPlaybackProgressRequest: vi.fn(),
  };
  const { rerender, unmount } = render(
    createElement(OnlineFleetMap, { ...props, trackViewModel: firstTrack }),
  );

  await waitFor(() => expect(mapMocks.mapResize).toHaveBeenCalled());

  rerender(
    createElement(OnlineFleetMap, {
      ...props,
      trackViewModel: secondTrack,
      playbackPoint: secondTrack.start,
    }),
  );
  unmount();

  expect(mapMocks.mapOff).toHaveBeenCalledWith(
    'mousemove',
    'vehicle-track-hitbox',
    expect.any(Function),
  );
  expect(mapMocks.mapRemoveLayer).toHaveBeenCalledWith('vehicle-track-lines');
  expect(mapMocks.mapRemoveSource).toHaveBeenCalledWith('vehicle-track');
  expect(mapMocks.popupRemove).toHaveBeenCalled();
});

it('сериализует сегменты и события в GeoJSON без потери координат маршрута', async () => {
  const { trackEventsToGeoJson, trackSegmentsToGeoJson } = await import('./VehicleTrackLayers');
  const track = getTrackViewModel('lada-vesta-a123mr77');

  const segments = trackSegmentsToGeoJson(track.segments);
  const events = trackEventsToGeoJson(track.events);

  expect(segments.features[0]).toMatchObject({
    id: track.segments[0].id,
    geometry: {
      type: 'LineString',
      coordinates: [track.segments[0].from.coordinates, track.segments[0].to.coordinates],
    },
    properties: {
      color: '#22c55e',
      opacity: 0.72,
    },
  });
  expect(events.features[0]).toMatchObject({
    id: track.events[0].id,
    geometry: {
      type: 'Point',
      coordinates: track.events[0].coordinates,
    },
  });
});

it('регистрирует видимую линию, hitbox, события, концы и направление маршрута', async () => {
  const { mountVehicleTrackLayers } = await import('./VehicleTrackLayers');
  const track = getTrackViewModel('lada-vesta-a123mr77');
  const map = {
    addLayer: mapMocks.mapAddLayer,
    addSource: mapMocks.mapAddSource,
    getCanvas: () => mapMocks.canvas,
    getLayer: mapMocks.mapGetLayer,
    getSource: mapMocks.mapGetSource,
    off: mapMocks.mapOff,
    on: mapMocks.mapOn,
    removeLayer: mapMocks.mapRemoveLayer,
    removeSource: mapMocks.mapRemoveSource,
    setFeatureState: mapMocks.mapSetFeatureState,
  } as unknown as Parameters<typeof mountVehicleTrackLayers>[0];

  const unmountLayers = mountVehicleTrackLayers(map, {
    trackViewModel: track,
    selectedEventId: null,
    onSegmentHover: vi.fn(),
    onSegmentLeave: vi.fn(),
    onEventSelect: vi.fn(),
    onPlaybackProgressRequest: vi.fn(),
  });

  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-lines',
      paint: expect.objectContaining({
        'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.72],
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-hitbox',
      paint: expect.objectContaining({ 'line-width': 16 }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'vehicle-track-events', type: 'circle' }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'vehicle-track-endpoints', type: 'circle' }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'vehicle-track-directions', type: 'symbol' }),
  );

  unmountLayers();
  expect(mapMocks.mapOff).toHaveBeenCalledWith(
    'mousemove',
    'vehicle-track-hitbox',
    expect.any(Function),
  );
});

it('показывает доступное русское описание сгруппированного события', async () => {
  const { TrackEventPopup } = await import('./TrackEventPopup');
  const event = getTrackViewModel('lada-vesta-a123mr77').events[0];

  render(createElement(TrackEventPopup, { event, count: 2 }));

  expect(screen.getByRole('article', { name: `Событие: ${event.title}` })).toBeTruthy();
  expect(screen.getByText('2 события')).toBeTruthy();
  expect(screen.getByText(`${event.timestamp} · ${event.speedKph} км/ч`)).toBeTruthy();
  expect(screen.getByText(event.address)).toBeTruthy();
  expect(screen.getByText(event.description)).toBeTruthy();
});
