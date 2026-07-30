// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { buildTrackPeriodViewModel, getVehicleTrack } from '../track-model';
import type { VehicleTrackPeriodViewModel } from '../track-types';
import type { OnlineMapVehicle } from '../types';
import { OnlineFleetMap } from './OnlineFleetMap';

const mapMocks = vi.hoisted(() => {
  const canvas = document.createElement('canvas');
  const loadHandlers = new Set<() => void>();

  return {
    canvas,
    loadHandlers,
    fireLoad: () => {
      const handlers = [...loadHandlers];
      loadHandlers.clear();
      handlers.forEach((handler) => handler());
    },
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
    resizeObserverCallbacks: [] as ResizeObserverCallback[],
    markerRemove: vi.fn(),
    popupRemove: vi.fn(),
    reactRootContainers: [] as (Element | Document | DocumentFragment)[],
    reactRootUnmount: vi.fn(),
  };
});

vi.mock('react-dom/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom/client')>();

  return {
    ...actual,
    createRoot: (
      container: Parameters<typeof actual.createRoot>[0],
      options?: Parameters<typeof actual.createRoot>[1],
    ) => {
      const root = actual.createRoot(container, options);
      mapMocks.reactRootContainers.push(container);

      return {
        render: root.render.bind(root),
        unmount: () => {
          mapMocks.reactRootUnmount(container);
          root.unmount();
        },
      };
    },
  };
});

vi.mock('maplibre-gl', () => {
  class Map {
    getCanvas = vi.fn(() => mapMocks.canvas);
    addControl = vi.fn();
    once = mapMocks.mapOnce;
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
    element: HTMLElement;

    constructor(options?: { element?: HTMLElement }) {
      this.element = options?.element ?? document.createElement('div');
    }

    setLngLat() {
      return this;
    }

    addTo() {
      return this;
    }

    getElement() {
      return this.element;
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

function getTrackViewModel(vehicleId: string): VehicleTrackPeriodViewModel {
  const track = getVehicleTrack(vehicleId, '2026-07-29');

  if (!track) {
    throw new Error('Тестовый маршрут не найден');
  }

  return buildTrackPeriodViewModel([track], 'day');
}

beforeEach(() => {
  vi.clearAllMocks();
  mapMocks.loadHandlers.clear();
  mapMocks.resizeObserverCallbacks.length = 0;
  mapMocks.reactRootContainers.length = 0;
  mapMocks.mapOnce.mockImplementation((event: string, handler: () => void) => {
    if (event === 'load') mapMocks.loadHandlers.add(handler);
  });
  mapMocks.mapOff.mockImplementation((event: string, layerOrHandler: string | (() => void)) => {
    if (event === 'load' && typeof layerOrHandler === 'function') {
      mapMocks.loadHandlers.delete(layerOrHandler);
    }
  });
  mapMocks.mapLoaded.mockReturnValue(true);
  mapMocks.mapGetLayer.mockReturnValue({});
  mapMocks.mapGetSource.mockReturnValue({});
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        mapMocks.resizeObserverCallbacks.push(callback);
      }
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
  vi.restoreAllMocks();
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

it('поднимает мобильные контролы карты над панелью высотой 48dvh и safe area', () => {
  render(
    createElement(OnlineFleetMap, {
      vehicles,
      selectedVehicleId: null,
      trackViewModel: null,
      playbackPoint: null,
      selectedEventId: null,
      onVehicleSelect: vi.fn(),
      onEventActivate: vi.fn(),
      onPlaybackPointRequest: vi.fn(),
    }),
  );

  const mapShell = screen.getByLabelText('Онлайн-карта автопарка').parentElement;
  expect(mapShell?.className).toContain(
    '[&_.maplibregl-ctrl-bottom-right]:bottom-[calc(48dvh+max(1rem,env(safe-area-inset-bottom)))]',
  );
  expect(mapShell?.className).not.toContain('calc(42dvh');
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
    onEventActivate: vi.fn(),
    onPlaybackPointRequest: vi.fn(),
  };
  const { rerender, unmount } = render(
    createElement(OnlineFleetMap, { ...props, trackViewModel: firstTrack }),
  );

  act(() => mapMocks.fireLoad());
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

it('монтирует новый маршрут сразу после первого load, даже если loaded временно false', async () => {
  const firstTrack = getTrackViewModel('lada-vesta-a123mr77');
  const secondTrack = getTrackViewModel('haval-jolion-v456kh178');
  mapMocks.mapLoaded.mockReturnValue(false);
  const props = {
    vehicles,
    selectedVehicleId: vehicles[0].id,
    playbackPoint: firstTrack.start,
    selectedEventId: null,
    onVehicleSelect: vi.fn(),
    onEventActivate: vi.fn(),
    onPlaybackPointRequest: vi.fn(),
  };
  const { rerender } = render(
    createElement(OnlineFleetMap, { ...props, trackViewModel: firstTrack }),
  );

  act(() => mapMocks.fireLoad());
  await waitFor(() => expect(mapMocks.mapAddSource).toHaveBeenCalledTimes(3));
  mapMocks.mapAddSource.mockClear();

  rerender(
    createElement(OnlineFleetMap, {
      ...props,
      trackViewModel: secondTrack,
      playbackPoint: secondTrack.start,
    }),
  );

  await waitFor(() => expect(mapMocks.mapAddSource).toHaveBeenCalledTimes(3));
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
      tripId: track.activeTrip.tripId,
      tripIndex: 0,
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

it('вычисляет fit padding по ширине контейнера карты, а не окна', async () => {
  const { getTrackFitOptions } = await import('./OnlineFleetMap');

  expect(getTrackFitOptions(640, 900, true).padding).toEqual({
    top: 96,
    right: 24,
    bottom: 432,
    left: 24,
  });
  expect(getTrackFitOptions(1024, 600, true).padding).toEqual({
    top: 32,
    right: 352,
    bottom: 32,
    left: 32,
  });
});

it('повторно вписывает маршрут при смене container breakpoint и ориентации', async () => {
  let width = 640;
  let height = 800;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
  const track = getTrackViewModel('lada-vesta-a123mr77');

  render(
    createElement(OnlineFleetMap, {
      vehicles,
      selectedVehicleId: vehicles[0].id,
      trackViewModel: track,
      playbackPoint: track.start,
      selectedEventId: null,
      onVehicleSelect: vi.fn(),
      onEventActivate: vi.fn(),
      onPlaybackPointRequest: vi.fn(),
    }),
  );

  act(() => mapMocks.fireLoad());
  await waitFor(() => expect(mapMocks.mapFitBounds).toHaveBeenCalled());
  mapMocks.mapFitBounds.mockClear();
  const trackResize = mapMocks.resizeObserverCallbacks.at(-1);

  width = 1024;
  height = 600;
  act(() => trackResize?.([], {} as ResizeObserver));
  expect(mapMocks.mapFitBounds).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      padding: { top: 32, right: 352, bottom: 32, left: 32 },
    }),
  );

  mapMocks.mapFitBounds.mockClear();
  height = 1200;
  act(() => trackResize?.([], {} as ResizeObserver));
  expect(mapMocks.mapFitBounds).toHaveBeenCalledTimes(1);
});

it('регистрирует видимую линию, hitbox, события, концы и направление маршрута', async () => {
  const { mountVehicleTrackLayers } = await import('./VehicleTrackLayers');
  const track = getTrackViewModel('lada-vesta-a123mr77');
  const onEventActivate = vi.fn();
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
    onEventActivate,
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
    expect.objectContaining({
      id: 'vehicle-track-event-hitbox',
      type: 'circle',
      paint: expect.objectContaining({ 'circle-radius': 22 }),
    }),
  );
  expect(mapMocks.mapOn).toHaveBeenCalledWith(
    'mousemove',
    'vehicle-track-event-hitbox',
    expect.any(Function),
  );
  expect(mapMocks.mapOn).toHaveBeenCalledWith(
    'mouseleave',
    'vehicle-track-event-hitbox',
    expect.any(Function),
  );
  expect(mapMocks.mapOn).toHaveBeenCalledWith(
    'click',
    'vehicle-track-event-hitbox',
    expect.any(Function),
  );
  const eventClickHandler = mapMocks.mapOn.mock.calls.find(
    ([eventName, layerId]) => eventName === 'click' && layerId === 'vehicle-track-event-hitbox',
  )?.[2] as ((event: { features: { id: string }[] }) => void) | undefined;
  expect(eventClickHandler).toBeTypeOf('function');
  eventClickHandler?.({ features: [{ id: track.eventGroups[0].id }] });
  expect(onEventActivate).toHaveBeenCalledExactlyOnceWith(
    track.eventGroups[0],
    track.eventGroups[0].count,
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
  expect(mapMocks.mapOff).toHaveBeenCalledWith(
    'click',
    'vehicle-track-event-hitbox',
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

it('немедленно размонтирует popup root при ошибке регистрации трекового слоя', async () => {
  const track = getTrackViewModel('lada-vesta-a123mr77');
  const props = {
    vehicles,
    selectedVehicleId: vehicles[0].id,
    trackViewModel: null,
    playbackPoint: null,
    selectedEventId: null,
    onVehicleSelect: vi.fn(),
    onEventActivate: vi.fn(),
    onPlaybackPointRequest: vi.fn(),
  };
  const { rerender } = render(createElement(OnlineFleetMap, props));

  act(() => mapMocks.fireLoad());
  await waitFor(() => expect(mapMocks.mapResize).toHaveBeenCalled());

  mapMocks.reactRootContainers.length = 0;
  mapMocks.reactRootUnmount.mockClear();
  mapMocks.mapAddLayer.mockImplementationOnce(() => {
    throw new Error('Тестовая ошибка слоя');
  });

  rerender(
    createElement(OnlineFleetMap, {
      ...props,
      trackViewModel: track,
      playbackPoint: track.start,
      selectedEventId: null,
      onEventActivate: vi.fn(),
    }),
  );

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('Маршрут временно недоступен'),
  );
  await act(async () => Promise.resolve());

  expect(mapMocks.reactRootContainers).toHaveLength(1);
  expect(mapMocks.reactRootUnmount).toHaveBeenCalledWith(mapMocks.reactRootContainers[0]);
});

it('повторяет только трековые ресурсы после ошибки, не пересоздавая базовую карту', async () => {
  const track = getTrackViewModel('lada-vesta-a123mr77');
  mapMocks.mapAddLayer.mockImplementationOnce(() => {
    throw new Error('Тестовая ошибка слоя');
  });

  render(
    createElement(OnlineFleetMap, {
      vehicles,
      selectedVehicleId: vehicles[0].id,
      trackViewModel: track,
      playbackPoint: track.start,
      selectedEventId: null,
      onVehicleSelect: vi.fn(),
      onEventActivate: vi.fn(),
      onPlaybackPointRequest: vi.fn(),
    }),
  );

  act(() => mapMocks.fireLoad());
  const retry = await screen.findByRole('button', { name: 'Повторить маршрут' });
  const mapRemoveCallsBeforeRetry = mapMocks.mapRemove.mock.calls.length;
  mapMocks.mapAddLayer.mockImplementation(() => undefined);

  fireEvent.click(retry);

  await waitFor(() => expect(mapMocks.mapAddSource.mock.calls.length).toBeGreaterThan(3));
  expect(screen.queryByRole('button', { name: 'Повторить маршрут' })).toBeNull();
  expect(mapMocks.mapRemove).toHaveBeenCalledTimes(mapRemoveCallsBeforeRetry);
  expect(mapMocks.mapAddSource.mock.calls.length).toBeGreaterThan(3);
});
