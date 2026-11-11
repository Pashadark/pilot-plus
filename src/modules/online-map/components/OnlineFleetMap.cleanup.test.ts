// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { getVehicleTrack } from '../track-fixture-model';
import { buildTrackPeriodViewModel } from '../track-model';
import type { VehicleTrackPeriodViewModel } from '../track-types';
import type { OnlineMapVehicle } from '../types';
import { OnlineFleetMap } from './OnlineFleetMap';

const mapMocks = vi.hoisted(() => {
  const canvas = document.createElement('canvas');
  const mapContainer = document.createElement('div');
  const loadHandlers = new Set<() => void>();

  return {
    canvas,
    mapContainer,
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
    mapIsStyleLoaded: vi.fn<() => boolean | undefined>(() => true),
    mapGetLayer: vi.fn(),
    mapGetSource: vi.fn(),
    playbackSourceSetData: vi.fn(),
    mapAddLayer: vi.fn(),
    mapAddSource: vi.fn(),
    mapAddImage: vi.fn(),
    mapGetImage: vi.fn(),
    mapRemoveImage: vi.fn(),
    mapGetPaintProperty: vi.fn(),
    mapSetPaintProperty: vi.fn(),
    mapRemoveLayer: vi.fn(),
    mapRemoveSource: vi.fn(),
    mapSetFeatureState: vi.fn(),
    mapFitBounds: vi.fn(),
    mapConstruct: vi.fn(),
    resizeObserverCallbacks: [] as ResizeObserverCallback[],
    markerRemove: vi.fn(),
    markerSetLngLat: vi.fn(),
    markerSetRotation: vi.fn(),
    markerOptions: [] as Array<Record<string, unknown>>,
    popupRemove: vi.fn(),
    popupOptions: [] as unknown[],
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
    constructor() {
      mapMocks.mapConstruct();
    }

    getCanvas = vi.fn(() => mapMocks.canvas);
    getContainer = vi.fn(() => mapMocks.mapContainer);
    addControl = vi.fn();
    once = mapMocks.mapOnce;
    on = mapMocks.mapOn;
    off = mapMocks.mapOff;
    loaded = mapMocks.mapLoaded;
    isStyleLoaded = mapMocks.mapIsStyleLoaded;
    resize = mapMocks.mapResize;
    remove = mapMocks.mapRemove;
    getLayer = mapMocks.mapGetLayer;
    getSource = mapMocks.mapGetSource;
    addLayer = mapMocks.mapAddLayer;
    addSource = mapMocks.mapAddSource;
    addImage = mapMocks.mapAddImage;
    getImage = mapMocks.mapGetImage;
    removeImage = mapMocks.mapRemoveImage;
    getPaintProperty = mapMocks.mapGetPaintProperty;
    setPaintProperty = mapMocks.mapSetPaintProperty;
    removeLayer = mapMocks.mapRemoveLayer;
    removeSource = mapMocks.mapRemoveSource;
    setFeatureState = mapMocks.mapSetFeatureState;
    fitBounds = mapMocks.mapFitBounds;
    flyTo = vi.fn();
  }

  class Marker {
    element: HTMLElement;

    constructor(options?: { element?: HTMLElement } & Record<string, unknown>) {
      this.element = options?.element ?? document.createElement('div');
      mapMocks.markerOptions.push(options ?? {});
    }

    setLngLat(coordinates: [number, number]) {
      mapMocks.markerSetLngLat(coordinates);
      return this;
    }

    addTo() {
      return this;
    }

    getElement() {
      return this.element;
    }

    setRotation(rotation: number) {
      mapMocks.markerSetRotation(rotation);
      return this;
    }

    remove = mapMocks.markerRemove;
  }

  class Popup {
    constructor(options?: unknown) {
      mapMocks.popupOptions.push(options);
    }

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
    gpsStatus: { key: 'MOVING', label: 'В движении', tone: 'primary', isConnected: true },
    speedKph: 42,
    heading: 90,
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
  mapMocks.popupOptions.length = 0;
  mapMocks.markerOptions.length = 0;
  mapMocks.reactRootContainers.length = 0;
  mapMocks.mapContainer.replaceChildren();
  delete mapMocks.mapContainer.dataset.trackCasingWidth;
  delete mapMocks.mapContainer.dataset.trackLineOffset;
  mapMocks.mapOnce.mockImplementation((event: string, handler: () => void) => {
    if (event === 'load') mapMocks.loadHandlers.add(handler);
  });
  mapMocks.mapOff.mockImplementation((event: string, layerOrHandler: string | (() => void)) => {
    if (event === 'load' && typeof layerOrHandler === 'function') {
      mapMocks.loadHandlers.delete(layerOrHandler);
    }
  });
  mapMocks.mapLoaded.mockReturnValue(true);
  mapMocks.mapIsStyleLoaded.mockReturnValue(true);
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

it('не пересоздаёт карту при GPS-обновлении активной машины', () => {
  const props = {
    vehicles,
    selectedVehicleId: vehicles[0].id,
    trackViewModel: null,
    playbackPoint: null,
    selectedEventId: null,
    previewedEventId: null,
    previewedSegmentId: null,
    onVehicleSelect: vi.fn(),
    onEventPreview: vi.fn(),
    onEventActivate: vi.fn(),
    onSegmentPreview: vi.fn(),
  };
  const { rerender } = render(createElement(OnlineFleetMap, props));

  expect(mapMocks.mapConstruct).toHaveBeenCalledTimes(1);
  mapMocks.markerSetLngLat.mockClear();

  rerender(
    createElement(OnlineFleetMap, {
      ...props,
      vehicles: [{ ...vehicles[0], latitude: 56.019, longitude: 92.861 }],
    }),
  );

  expect(mapMocks.mapConstruct).toHaveBeenCalledTimes(1);
  expect(mapMocks.mapRemove).not.toHaveBeenCalled();
  expect(mapMocks.markerSetLngLat).toHaveBeenCalledWith([92.861, 56.019]);
});

it('укладывает маркер машины в плоскость карты и обновляет его курс через MapLibre', () => {
  const props = {
    vehicles,
    selectedVehicleId: vehicles[0].id,
    trackViewModel: null,
    playbackPoint: null,
    selectedEventId: null,
    previewedEventId: null,
    previewedSegmentId: null,
    onVehicleSelect: vi.fn(),
    onEventPreview: vi.fn(),
    onEventActivate: vi.fn(),
    onSegmentPreview: vi.fn(),
  };
  const { rerender } = render(createElement(OnlineFleetMap, props));

  expect(mapMocks.markerOptions[0]).toEqual(
    expect.objectContaining({
      anchor: 'center',
      pitchAlignment: 'map',
      rotationAlignment: 'map',
      rotation: 90,
    }),
  );

  rerender(
    createElement(OnlineFleetMap, {
      ...props,
      vehicles: [{ ...vehicles[0], heading: 135 }],
    }),
  );

  expect(mapMocks.markerSetRotation).toHaveBeenCalledWith(135);
});

it('поднимает мобильные контролы карты над панелью высотой 48dvh и safe area', () => {
  render(
    createElement(OnlineFleetMap, {
      vehicles,
      selectedVehicleId: null,
      trackViewModel: null,
      playbackPoint: null,
      selectedEventId: null,
      previewedEventId: null,
      previewedSegmentId: null,
      onVehicleSelect: vi.fn(),
      onEventPreview: vi.fn(),
      onEventActivate: vi.fn(),
      onSegmentPreview: vi.fn(),
    }),
  );

  const mapShell = screen.getByLabelText('Онлайн-карта автопарка').parentElement;
  expect(mapShell?.className).toContain(
    '[&_.maplibregl-ctrl-bottom-right]:bottom-[calc(48dvh+max(1rem,env(safe-area-inset-bottom)))]',
  );
  expect(mapShell?.className).not.toContain('calc(42dvh');
});

it('не создаёт маркер для машины без координат GLONASSSOFT', () => {
  const vehicleWithoutCoordinates: readonly OnlineMapVehicle[] = [
    {
      ...vehicles[0],
      latitude: null,
      longitude: null,
      gpsStatus: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
    },
  ];

  render(
    createElement(OnlineFleetMap, {
      vehicles: vehicleWithoutCoordinates,
      selectedVehicleId: null,
      trackViewModel: null,
      playbackPoint: null,
      selectedEventId: null,
      previewedEventId: null,
      previewedSegmentId: null,
      onVehicleSelect: vi.fn(),
      onEventPreview: vi.fn(),
      onEventActivate: vi.fn(),
      onSegmentPreview: vi.fn(),
    }),
  );

  expect(screen.getByText('Координаты ещё не получены')).toBeTruthy();
  expect(mapMocks.reactRootContainers).toHaveLength(0);
});

it('оставляет data probe маршрута вне последовательного tab-flow', async () => {
  const track = getTrackViewModel('lada-vesta-a123mr77');
  render(
    createElement(OnlineFleetMap, {
      vehicles,
      selectedVehicleId: vehicles[0].id,
      trackViewModel: track,
      playbackPoint: track.start,
      selectedEventId: null,
      previewedEventId: null,
      previewedSegmentId: null,
      onVehicleSelect: vi.fn(),
      onEventPreview: vi.fn(),
      onEventActivate: vi.fn(),
      onSegmentPreview: vi.fn(),
    }),
  );

  act(() => mapMocks.fireLoad());
  const probe = await screen.findByTestId('vehicle-track-a11y');
  expect(probe.querySelectorAll('button')).toHaveLength(0);
  expect(probe.querySelectorAll('[tabindex]')).toHaveLength(0);
});

it('сохраняет масштаб при обновлении точек того же маршрута', async () => {
  const track = getTrackViewModel('lada-vesta-a123mr77');
  const props = {
    vehicles,
    selectedVehicleId: vehicles[0].id,
    playbackPoint: track.start,
    selectedEventId: null,
    previewedEventId: null,
    previewedSegmentId: null,
    onVehicleSelect: vi.fn(),
    onEventPreview: vi.fn(),
    onEventActivate: vi.fn(),
    onSegmentPreview: vi.fn(),
  };
  const { rerender } = render(createElement(OnlineFleetMap, { ...props, trackViewModel: track }));
  act(() => mapMocks.fireLoad());
  await waitFor(() => expect(mapMocks.mapFitBounds).toHaveBeenCalled());
  mapMocks.mapFitBounds.mockClear();
  rerender(createElement(OnlineFleetMap, { ...props, trackViewModel: { ...track } }));
  expect(mapMocks.mapFitBounds).not.toHaveBeenCalled();
});

it('удаляет обработчики, popup, источники и слои маршрута при смене автомобиля', async () => {
  const firstTrack = getTrackViewModel('lada-vesta-a123mr77');
  const secondTrack = getTrackViewModel('haval-jolion-v456kh178');
  const props = {
    vehicles,
    selectedVehicleId: vehicles[0].id,
    playbackPoint: firstTrack.start,
    selectedEventId: null,
    previewedEventId: null,
    previewedSegmentId: null,
    onVehicleSelect: vi.fn(),
    onEventPreview: vi.fn(),
    onEventActivate: vi.fn(),
    onSegmentPreview: vi.fn(),
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
  expect(mapMocks.mapRemoveLayer).toHaveBeenCalledWith('vehicle-track-gradient-0');
  expect(mapMocks.mapRemoveSource).toHaveBeenCalledWith('vehicle-track-gradient-0');
  expect(mapMocks.popupRemove).toHaveBeenCalled();
});

it('не обращается к слоям после уничтожения style карты', async () => {
  const track = getTrackViewModel('lada-vesta-a123mr77');
  const { unmount } = render(
    createElement(OnlineFleetMap, {
      vehicles,
      selectedVehicleId: vehicles[0].id,
      trackViewModel: track,
      playbackPoint: track.start,
      selectedEventId: null,
      previewedEventId: null,
      previewedSegmentId: null,
      onVehicleSelect: vi.fn(),
      onEventPreview: vi.fn(),
      onEventActivate: vi.fn(),
      onSegmentPreview: vi.fn(),
    }),
  );

  act(() => mapMocks.fireLoad());
  await waitFor(() => expect(mapMocks.mapAddSource).toHaveBeenCalled());

  mapMocks.mapGetLayer.mockClear();
  mapMocks.mapIsStyleLoaded.mockReturnValue(undefined);
  mapMocks.mapGetLayer.mockImplementation(() => {
    throw new TypeError("Cannot read properties of null (reading 'getLayer')");
  });

  expect(() => unmount()).not.toThrow();
  expect(mapMocks.mapGetLayer).not.toHaveBeenCalled();
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
    previewedEventId: null,
    previewedSegmentId: null,
    onVehicleSelect: vi.fn(),
    onEventPreview: vi.fn(),
    onEventActivate: vi.fn(),
    onSegmentPreview: vi.fn(),
  };
  const { rerender } = render(
    createElement(OnlineFleetMap, { ...props, trackViewModel: firstTrack }),
  );

  act(() => mapMocks.fireLoad());
  await waitFor(() => expect(mapMocks.mapAddSource).toHaveBeenCalledTimes(5));
  mapMocks.mapAddSource.mockClear();

  rerender(
    createElement(OnlineFleetMap, {
      ...props,
      trackViewModel: secondTrack,
      playbackPoint: secondTrack.start,
    }),
  );

  await waitFor(() => expect(mapMocks.mapAddSource).toHaveBeenCalledTimes(5));
});

it('монтирует маршрут сразу, если карта уже успела загрузиться до эффекта трека', async () => {
  const track = getTrackViewModel('lada-vesta-a123mr77');
  mapMocks.mapLoaded.mockReturnValue(true);
  mapMocks.mapGetLayer.mockReturnValue(undefined);
  mapMocks.mapGetSource.mockReturnValue(undefined);

  render(
    createElement(OnlineFleetMap, {
      vehicles,
      selectedVehicleId: vehicles[0].id,
      trackViewModel: track,
      playbackPoint: track.start,
      selectedEventId: null,
      previewedEventId: null,
      previewedSegmentId: null,
      onVehicleSelect: vi.fn(),
      onEventPreview: vi.fn(),
      onEventActivate: vi.fn(),
      onSegmentPreview: vi.fn(),
    }),
  );

  await waitFor(() => expect(mapMocks.mapAddSource).toHaveBeenCalled());
  expect(screen.getByTestId('vehicle-track-a11y').getAttribute('data-track-ready')).toBe('true');
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
      coordinates: expect.arrayContaining([
        track.segments[0].from.coordinates,
        track.segments[0].to.coordinates,
      ]),
    },
    properties: {
      color: '#22c55e',
      opacity: 0.72,
      tripId: track.activeTrip.tripId,
      tripIndex: 0,
    },
  });
  expect(segments.features[0].geometry.coordinates).toHaveLength(7);
  expect(segments.features.some((feature) => feature.properties.color === '#f97316')).toBe(true);
  expect(events.features[0]).toMatchObject({
    id: track.events[0].id,
    geometry: {
      type: 'Point',
      coordinates: track.events[0].coordinates,
    },
    properties: {
      icon: 'vehicle-track-event-stop',
    },
  });
  const acceleration = trackEventsToGeoJson([
    {
      ...track.events[0],
      id: 'acceleration-1',
      type: 'harsh-acceleration',
      metricLabel: '20→65',
    },
  ]);
  expect(acceleration.features[0]).toMatchObject({
    geometry: { coordinates: track.events[0].coordinates },
    properties: {
      eventColor: '#f59e0b',
      metricLabel: '20→65',
      icon: 'vehicle-track-event-harsh-acceleration',
    },
  });
  const braking = trackEventsToGeoJson([
    {
      ...track.events[0],
      id: 'braking-1',
      type: 'harsh-braking',
      metricLabel: '92→48',
    },
  ]);
  expect(braking.features[0]).toMatchObject({
    geometry: { coordinates: track.events[0].coordinates },
    properties: {
      eventColor: '#0067ff',
      metricLabel: '92→48',
      icon: 'vehicle-track-event-harsh-braking',
    },
  });
});

it('создаёт девять различных raster-иконок событий, включая разгон и торможение', async () => {
  const { createTrackEventIconImage, getTrackEventIconId } = await import('./VehicleTrackLayers');
  const types = [
    'stop',
    'refuel',
    'speeding',
    'fine',
    'connection-loss',
    'geofence-enter',
    'geofence-exit',
    'harsh-acceleration',
    'harsh-braking',
  ] as const;
  const ids = types.map(getTrackEventIconId);
  const images = types.map((type) => createTrackEventIconImage(type));

  expect(new Set(ids).size).toBe(9);
  expect(images.every((image) => image.width === 56 && image.height === 56)).toBe(true);
  expect(new Set(images.map((image) => Array.from(image.data).join(','))).size).toBe(9);
});

it('рисует 28px поинт с графитовым центром и тонкой тематической обводкой', async () => {
  const { createTrackEventIconImage } = await import('./VehicleTrackLayers');
  const dark = createTrackEventIconImage('speeding', 'dark');
  const light = createTrackEventIconImage('speeding', 'light');

  expect(dark).toMatchObject({ width: 56, height: 56 });
  expect(pixelAt(dark, 28, 28)).toEqual([23, 23, 28, 255]);
  expect(pixelAt(light, 28, 28)).toEqual([248, 250, 252, 255]);
  expect(pixelAt(dark, 28, 1)).toEqual([239, 68, 68, 255]);
});

it('различает события не только цветом, но и формой иконки', async () => {
  const { createTrackEventIconImage } = await import('./VehicleTrackLayers');
  const semanticImages = [
    createTrackEventIconImage('speeding'),
    createTrackEventIconImage('harsh-acceleration'),
    createTrackEventIconImage('harsh-braking'),
    createTrackEventIconImage('connection-loss'),
  ];

  expect(new Set(semanticImages.map((image) => Array.from(image.data).join(','))).size).toBe(4);
});

it('отключает пульсацию при reduced motion и на скрытой вкладке', async () => {
  const { shouldAnimateTrackEventPulse } = await import('./VehicleTrackLayers');

  expect(shouldAnimateTrackEventPulse(true, 'visible')).toBe(false);
  expect(shouldAnimateTrackEventPulse(false, 'hidden')).toBe(false);
  expect(shouldAnimateTrackEventPulse(false, 'visible')).toBe(true);
});

it('создаёт компактные разные маркеры старта и финиша с клетчатым флагом', async () => {
  const { createTrackEndpointIconImage, getTrackEndpointIconId } =
    await import('./VehicleTrackLayers');
  const start = createTrackEndpointIconImage('start');
  const finish = createTrackEndpointIconImage('finish');

  expect(getTrackEndpointIconId('start')).toBe('vehicle-track-endpoint-start');
  expect(getTrackEndpointIconId('finish')).toBe('vehicle-track-endpoint-finish');
  expect(start).toMatchObject({ width: 56, height: 56 });
  expect(finish).toMatchObject({ width: 56, height: 56 });
  expect(Array.from(start.data)).not.toEqual(Array.from(finish.data));
  const whitePixels = Array.from({ length: finish.width * finish.height }, (_, index) =>
    Array.from(finish.data.slice(index * 4, index * 4 + 4)),
  ).filter((pixel) => pixel.join(',') === '255,255,255,255');
  expect(whitePixels.length).toBeGreaterThan(20);
});

it('вычисляет fit padding по ширине контейнера карты, а не окна', async () => {
  const { getTrackFitOptions } = await import('./OnlineFleetMap');

  expect(getTrackFitOptions(640, 900, true).padding).toEqual({
    top: 144,
    right: 24,
    bottom: 456,
    left: 24,
  });
  expect(getTrackFitOptions(1024, 600, true).padding).toEqual({
    top: 72,
    right: 416,
    bottom: 88,
    left: 392,
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
      previewedEventId: null,
      previewedSegmentId: null,
      onVehicleSelect: vi.fn(),
      onEventPreview: vi.fn(),
      onEventActivate: vi.fn(),
      onSegmentPreview: vi.fn(),
    }),
  );

  act(() => mapMocks.fireLoad());
  await waitFor(() => expect(mapMocks.mapFitBounds).toHaveBeenCalled());
  expect(mapMocks.popupOptions).toContainEqual(
    expect.objectContaining({ closeButton: true, focusAfterOpen: false }),
  );
  expect(mapMocks.popupOptions).toContainEqual(
    expect.objectContaining({
      className: 'maplibregl-popup-track-pointer',
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
    }),
  );
  mapMocks.mapFitBounds.mockClear();
  const trackResize = mapMocks.resizeObserverCallbacks.at(-1);

  width = 1024;
  height = 600;
  act(() => trackResize?.([], {} as ResizeObserver));
  expect(mapMocks.mapFitBounds).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      padding: { top: 72, right: 416, bottom: 88, left: 392 },
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
  const onEventPreview = vi.fn();
  let pulseFrame: FrameRequestCallback | undefined;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    pulseFrame = callback;
    return 77;
  });
  const cancelFrame = vi.fn();
  const clearTimer = vi.spyOn(window, 'clearTimeout');
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  const tripOffsetExpression = ['match', ['get', 'tripIndex'], 1, -5, 2, 5, 0];
  mapMocks.mapGetPaintProperty.mockImplementation((layerId: string, property: string) => {
    if (layerId === 'vehicle-track-casing' && property === 'line-width') return 8;
    if (layerId === 'vehicle-track-lines' && property === 'line-offset') {
      return tripOffsetExpression;
    }
    return undefined;
  });
  const map = {
    addLayer: mapMocks.mapAddLayer,
    addSource: mapMocks.mapAddSource,
    addImage: mapMocks.mapAddImage,
    getImage: mapMocks.mapGetImage,
    removeImage: mapMocks.mapRemoveImage,
    getContainer: () => mapMocks.mapContainer,
    getPaintProperty: mapMocks.mapGetPaintProperty,
    setPaintProperty: mapMocks.mapSetPaintProperty,
    getCanvas: () => mapMocks.canvas,
    getLayer: mapMocks.mapGetLayer,
    getSource: mapMocks.mapGetSource,
    isStyleLoaded: mapMocks.mapIsStyleLoaded,
    off: mapMocks.mapOff,
    on: mapMocks.mapOn,
    removeLayer: mapMocks.mapRemoveLayer,
    removeSource: mapMocks.mapRemoveSource,
    setFeatureState: mapMocks.mapSetFeatureState,
  } as unknown as Parameters<typeof mountVehicleTrackLayers>[0];

  const unmountLayers = mountVehicleTrackLayers(map, {
    trackViewModel: track,
    selectedEventId: null,
    onSegmentPreview: vi.fn(),
    onEventPreview,
    onEventActivate,
  });

  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-casing',
      paint: expect.objectContaining({
        'line-width': 8,
        'line-offset': ['match', ['get', 'tripIndex'], 1, -5, 2, 5, 0],
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-lines',
      paint: expect.objectContaining({
        'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.2, 0],
        'line-offset': ['match', ['get', 'tripIndex'], 1, -5, 2, 5, 0],
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-hitbox',
      paint: expect.objectContaining({ 'line-width': 16 }),
    }),
  );
  expect(mapMocks.mapAddSource).toHaveBeenCalledWith(
    'vehicle-track-gradient-0',
    expect.objectContaining({ lineMetrics: true }),
  );
  expect(mapMocks.mapAddSource).toHaveBeenCalledWith(
    'vehicle-track-playback',
    expect.objectContaining({ type: 'geojson' }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-playback',
      type: 'line',
      paint: expect.objectContaining({ 'line-color': '#0067ff' }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-gradient-0',
      paint: expect.objectContaining({
        'line-gradient': expect.arrayContaining([['line-progress']]),
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-events',
      type: 'circle',
      paint: expect.objectContaining({
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 3],
        'circle-stroke-color': '#343438',
        'circle-stroke-width': 1,
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-event-pulse',
      type: 'circle',
      source: 'vehicle-track-events',
    }),
    'vehicle-track-event-icons',
  );
  pulseFrame?.(1_000);
  expect(requestFrame).toHaveBeenCalledTimes(1);
  expect(mapMocks.mapSetPaintProperty).toHaveBeenCalledWith(
    'vehicle-track-event-pulse',
    'circle-radius',
    expect.any(Number),
  );
  expect(mapMocks.mapSetPaintProperty).toHaveBeenCalledWith(
    'vehicle-track-event-pulse',
    'circle-radius-transition',
    expect.objectContaining({ duration: expect.any(Number) }),
  );
  expect(mapMocks.mapAddLayer).not.toHaveBeenCalledWith(
    expect.objectContaining({ id: 'vehicle-track-event-leaders' }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-event-metrics',
      type: 'symbol',
      layout: expect.objectContaining({
        'text-field': ['get', 'metricLabel'],
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-event-hitbox',
      type: 'circle',
      paint: expect.objectContaining({ 'circle-radius': 28 }),
    }),
  );
  expect(mapMocks.mapOn).toHaveBeenCalledWith(
    'mousemove',
    'vehicle-track-event-hitbox',
    expect.any(Function),
  );
  const eventMoveHandler = mapMocks.mapOn.mock.calls.find(
    ([eventName, layerId]) => eventName === 'mousemove' && layerId === 'vehicle-track-event-hitbox',
  )?.[2] as ((event: { features: { id: string }[] }) => void) | undefined;
  const eventLeaveHandler = mapMocks.mapOn.mock.calls.find(
    ([eventName, layerId]) =>
      eventName === 'mouseleave' && layerId === 'vehicle-track-event-hitbox',
  )?.[2] as (() => void) | undefined;
  eventMoveHandler?.({ features: [{ id: track.eventGroups[0].id }] });
  expect(onEventPreview).toHaveBeenCalledWith(track.eventGroups[0]);
  eventLeaveHandler?.();
  expect(onEventPreview).toHaveBeenLastCalledWith(null);
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
  expect(onEventActivate).toHaveBeenCalledExactlyOnceWith(track.eventGroups[0]);
  expect(mapMocks.mapAddImage).toHaveBeenCalledTimes(11);
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-event-icons',
      type: 'symbol',
      layout: expect.objectContaining({
        'icon-image': ['get', 'icon'],
        'icon-offset': [0, 0],
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'vehicle-track-endpoints',
      type: 'symbol',
      layout: expect.objectContaining({
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.62, 13, 0.78, 15, 1],
        'icon-allow-overlap': true,
      }),
    }),
  );
  expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'vehicle-track-directions', type: 'symbol' }),
  );
  expect(mapMocks.mapContainer.dataset.trackCasingWidth).toBe('8');
  expect(mapMocks.mapContainer.dataset.trackLineOffset).toBe(JSON.stringify(tripOffsetExpression));

  unmountLayers();
  expect(cancelFrame).not.toHaveBeenCalled();
  expect(clearTimer).toHaveBeenCalled();
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
  expect(mapMocks.mapRemoveImage).toHaveBeenCalledTimes(11);
  expect(mapMocks.mapContainer.dataset.trackCasingWidth).toBeUndefined();
  expect(mapMocks.mapContainer.dataset.trackLineOffset).toBeUndefined();
});

function pixelAt(image: { width: number; data: Uint8Array }, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return Array.from(image.data.slice(offset, offset + 4));
}

it('показывает доступное русское описание сгруппированного события', async () => {
  const { TrackEventPopup } = await import('./TrackEventPopup');
  const event = getTrackViewModel('lada-vesta-a123mr77').events[0];

  render(createElement(TrackEventPopup, { event, count: 2 }));

  const popup = screen.getByRole('article', { name: `Событие: ${event.title}` });
  expect(popup.className).toContain('bg-[var(--color-surface)]');
  expect(popup.className).toContain('border-[var(--color-border)]');
  expect(popup.className).toContain('rounded-[var(--radius-md)]');
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
    previewedEventId: null,
    previewedSegmentId: null,
    onVehicleSelect: vi.fn(),
    onEventPreview: vi.fn(),
    onEventActivate: vi.fn(),
    onSegmentPreview: vi.fn(),
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

  expect(mapMocks.reactRootContainers).toHaveLength(2);
  expect(mapMocks.reactRootUnmount).toHaveBeenCalledWith(mapMocks.reactRootContainers[0]);
  expect(mapMocks.reactRootUnmount).toHaveBeenCalledWith(mapMocks.reactRootContainers[1]);
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
      previewedEventId: null,
      previewedSegmentId: null,
      onVehicleSelect: vi.fn(),
      onEventPreview: vi.fn(),
      onEventActivate: vi.fn(),
      onSegmentPreview: vi.fn(),
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
