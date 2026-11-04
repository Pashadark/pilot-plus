// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import type { OnlineFleetMapProps } from './OnlineFleetMap';
import { onlineMapVehicles } from '../fixtures';
import { getVehicleTrackDates, getVehicleTracks } from '../track-fixture-model';
import type { OnlineMapTrackHistoryDto } from '../track-types';
import type { OnlineMapVehicle } from '../types';
import {
  OnlineMapWorkspace as OnlineMapWorkspaceImplementation,
  type OnlineMapWorkspaceProps,
} from './OnlineMapWorkspace';
import { TrackDaySummary } from './TrackDaySummary';
import { TrackPlayback } from './TrackPlayback';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixtureHistory(vehicleId: string): OnlineMapTrackHistoryDto {
  const dates = getVehicleTrackDates(vehicleId);
  return {
    vehicleId,
    from: dates.at(-1) ?? '2026-07-23',
    to: dates[0] ?? '2026-07-29',
    availableDates: dates,
    tracks: getVehicleTracks(vehicleId, dates),
    fines: [],
  };
}

function OnlineMapWorkspace(props: OnlineMapWorkspaceProps) {
  return (
    <OnlineMapWorkspaceImplementation
      vehicles={onlineMapVehicles}
      historyProvider={fixtureHistory}
      {...props}
    />
  );
}

function FakeMap(props: OnlineFleetMapProps) {
  const { vehicles, selectedVehicleId, onVehicleSelect, trackViewModel, onEventActivate } = props;
  return (
    <div aria-label="Тестовая карта">
      <output
        data-testid="map-track-state"
        data-vehicle-id={trackViewModel?.vehicleId ?? ''}
        data-track-date={trackViewModel?.date ?? ''}
        data-track-period={trackViewModel?.period ?? ''}
        data-trip-count={trackViewModel?.trips.length ?? 0}
        data-playback-point={props.playbackPoint?.id ?? ''}
        data-selected-event={props.selectedEventId ?? ''}
        data-previewed-event={props.previewedEventId ?? ''}
        data-previewed-segment={props.previewedSegmentId ?? ''}
        data-first-speed={vehicles[0]?.speedKph ?? ''}
      />
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.id}
          type="button"
          aria-label={`Выбрать автомобиль ${vehicle.plate}`}
          aria-pressed={selectedVehicleId === vehicle.id}
          onClick={() => onVehicleSelect(vehicle)}
        >
          {vehicle.plate}
        </button>
      ))}
      {trackViewModel?.events.map((event) => (
        <button key={event.id} type="button" onClick={() => onEventActivate(event)}>
          Выбрать событие {event.title}
        </button>
      ))}
    </div>
  );
}

it('применяет живой SSE-снимок без перезагрузки страницы', async () => {
  const sources: FakeEventSource[] = [];
  class FakeEventSource {
    listeners = new Map<string, (event: MessageEvent<string>) => void>();
    close = vi.fn();
    constructor(public readonly url: string) {
      sources.push(this);
    }
    addEventListener(name: string, listener: (event: MessageEvent<string>) => void) {
      this.listeners.set(name, listener);
    }
    emitSnapshot(vehicles: unknown[]) {
      this.listeners.get('snapshot')?.(
        new MessageEvent('snapshot', { data: JSON.stringify({ vehicles }) }),
      );
    }
  }
  vi.stubGlobal('EventSource', FakeEventSource);
  const initial: OnlineMapVehicle[] = [
    {
      id: 'vehicle-live',
      name: 'Kia Ceed',
      plate: 'А429АУ997',
      gpsStatus: {
        key: 'IDLE',
        label: 'Стоит',
        tone: 'warning',
        isConnected: true,
      },
      longitude: 37.6,
      latitude: 55.7,
      speedKph: 0,
      fuelPercent: 50,
      recordedAt: '2026-08-23T06:00:00.000Z',
      lastSeenLabel: 'только что',
      address: 'Москва',
    },
  ];
  const view = render(<OnlineMapWorkspace mapComponent={FakeMap} vehicles={initial} />);

  expect(sources[0]?.url).toBe('/api/map/live');
  act(() => sources[0]?.emitSnapshot([{ ...initial[0], speedKph: 47, longitude: 37.7 }]));
  expect(getMapTrackState().firstSpeed).toBe('47');

  view.unmount();
  expect(sources[0]?.close).toHaveBeenCalled();
});

function getMapTrackState(): DOMStringMap {
  return (screen.getByTestId('map-track-state') as HTMLOutputElement).dataset;
}

it('сразу выбирает автомобиль, переданный из карточки автопарка', () => {
  render(
    <OnlineMapWorkspace mapComponent={FakeMap} initialSelectedVehicleId="lada-vesta-a123mr77" />,
  );

  expect(
    screen
      .getByRole('button', { name: 'Выбрать Lada Vesta А 123 МР 77' })
      .getAttribute('aria-current'),
  ).toBe('true');
  expect(screen.getByRole('complementary', { name: 'Выбранный автомобиль' })).toBeTruthy();
});

it('открывает дату и точное событие из безопасной глубокой ссылки', () => {
  const vehicleId = 'lada-vesta-a123mr77';
  const date = getVehicleTrackDates(vehicleId)[0];
  const eventId = `${vehicleId}-${date}-refuel`;

  render(
    <OnlineMapWorkspace
      mapComponent={FakeMap}
      initialSelectedVehicleId={vehicleId}
      initialTrackDate={date}
      initialSelectedEventId={eventId}
    />,
  );

  expect(getMapTrackState().trackDate).toBe(date);
  expect(getMapTrackState().selectedEvent).toBe(eventId);
});

it('ищет по модели и сбрасывает скрытый выбор без автоматического выбора первой машины', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(5);
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
  expect(screen.getByPlaceholderText('Модель, номер, водитель')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Выбрать Kia K5 К 111 МР 199' }));
  expect(
    screen
      .getByRole('button', { name: 'Выбрать Kia K5 К 111 МР 199' })
      .getAttribute('aria-current'),
  ).toBe('true');

  await user.type(screen.getByRole('searchbox', { name: 'Поиск автомобиля' }), 'Lada Vesta');

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(1);
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Выбрать Lada Vesta А 123 МР 77' })
        .getAttribute('aria-current'),
    ).toBeNull(),
  );
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
});

it('очищает выбор при пустом результате и позволяет сбросить фильтры без автовыбора', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.type(screen.getByRole('searchbox', { name: 'Поиск автомобиля' }), 'Р 999');

  expect(screen.queryAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(0);
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
  expect(screen.getByText('Машины не найдены. Измените поиск или фильтр.')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Сбросить' }));

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(5);
  expect(
    screen
      .getByRole('button', { name: 'Выбрать Lada Vesta А 123 МР 77' })
      .getAttribute('aria-current'),
  ).toBeNull();
});

it('закрывает мобильную панель в null и не выбирает машину до нового нажатия маркера', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  expect(screen.queryByRole('link', { name: '© OpenStreetMap' })).toBeNull();
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Выбрать Haval Jolion В 456 КХ 178' }));
  expect(
    screen.getByRole('complementary', { name: 'Выбранный автомобиль' }).querySelector('h2')
      ?.textContent,
  ).toBe('Haval Jolion');

  await user.click(screen.getByRole('button', { name: 'Закрыть карточку автомобиля' }));
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
  expect(
    screen
      .getByRole('button', { name: 'Выбрать Haval Jolion В 456 КХ 178' })
      .getAttribute('aria-current'),
  ).toBeNull();
  expect(screen.queryByRole('link', { name: '© OpenStreetMap' })).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Выбрать Geely Atlas Е 789 НО 77' }));
  expect(
    screen.getByRole('complementary', { name: 'Выбранный автомобиль' }).querySelector('h2')
      ?.textContent,
  ).toBe('Geely Atlas');
});

it('фильтрует все статусы с ожидаемым количеством автомобилей', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'В движении' }));
  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(2);

  await user.click(screen.getByRole('button', { name: 'Стоит' }));
  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(1);

  await user.click(screen.getByRole('button', { name: 'Давно' }));
  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Выбрать автомобиль К 111 МР 199' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'В парке' }));
  expect(screen.getByRole('button', { name: 'Выбрать автомобиль В 456 КХ 178' })).toBeTruthy();
});

it('держит автомобиль без координат в верхнем списке и фильтрует его как нет связи', async () => {
  const user = userEvent.setup();
  const vehicles = [
    {
      id: 'without-coordinates',
      name: 'Toyota Camry',
      plate: 'А 777 АА 77',
      longitude: null,
      latitude: null,
      speedKph: 0,
      fuelPercent: null,
      lastSeenLabel: 'координаты ещё не получены',
      address: 'Нет данных GLONASSSoft',
      gpsStatus: { key: 'NO_DATA', label: 'Нет связи', tone: 'danger', isConnected: false },
    },
  ] as never;

  render(<OnlineMapWorkspace mapComponent={FakeMap} vehicles={vehicles} />);

  expect(screen.getByRole('button', { name: 'Выбрать автомобиль А 777 АА 77' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Нет связи' }));
  expect(screen.getByRole('button', { name: 'Выбрать автомобиль А 777 АА 77' })).toBeTruthy();
});

it('без перезагрузки переводит свежий сигнал в устаревший после границы 15 минут', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:14:59.000Z'));
  const vehicles = [
    {
      id: 'fresh-boundary',
      name: 'Toyota Camry',
      plate: 'А 777 АА 77',
      longitude: 37.6,
      latitude: 55.7,
      speedKph: 30,
      fuelPercent: 50,
      recordedAt: '2026-08-20T12:00:00.000Z',
      lastSeenLabel: '14 минут назад',
      address: 'Москва',
      gpsStatus: { key: 'MOVING', label: 'В движении', tone: 'primary', isConnected: true },
    },
  ] as never;

  render(<OnlineMapWorkspace mapComponent={FakeMap} vehicles={vehicles} />);
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 777 АА 77' }));

  const panel = screen.getByRole('complementary', { name: 'Выбранный автомобиль' });
  expect(panel.textContent).toContain('В движении');

  act(() => vi.advanceTimersByTime(60_000));

  expect(panel.textContent).toContain('Давно не обновлялся');
});

it('использует container responsive layout и не дублирует атрибуцию MapLibre', () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  const workspace = screen.getByRole('region', { name: 'Онлайн-карта транспорта' });
  expect(workspace.className).toContain('@container');
  expect(workspace.className).toContain(
    '[@media(max-height:42rem)]:[&_.maplibregl-ctrl-group]:hidden',
  );

  expect(screen.queryByRole('link', { name: '© OpenStreetMap' })).toBeNull();
});

it('выносит playback в самостоятельную панель над картой', () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));

  const slider = screen.getByRole('slider', { name: 'Положение на маршруте' });
  const playbackDock = screen.getByTestId('track-playback-dock');
  expect(playbackDock.contains(slider)).toBe(true);
  expect(slider.closest('aside')).toBeNull();
  expect(playbackDock.className).toContain('z-40');
  expect(playbackDock.className).toContain('w-[min(34rem,calc(100%-2rem))]');
  expect(playbackDock.className).toContain('left-1/2');
  expect(playbackDock.className).not.toContain('right-[26rem]');
});

it('резервирует непересекающиеся desktop-зоны списка и карточки', () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));

  expect(screen.getByRole('complementary', { name: 'Автомобили' }).className).toContain(
    'w-[22.5rem]',
  );
  expect(screen.getByTestId('selected-vehicle-panel').className).toContain('w-[25rem]');
});

it('выбирает последнюю дату автомобиля и передаёт маршрут карте', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));

  const dateControl = screen.getByLabelText('Выбрать любую дату') as HTMLInputElement;
  expect(dateControl.value).toBe('2026-07-29');
  expect(screen.getByText('Сводка маршрута')).toBeTruthy();
  expect(getMapTrackState().vehicleId).toBe('lada-vesta-a123mr77');
  expect(getMapTrackState().playbackPoint).toContain('2026-07-29-p0');
});

it('меняет день кнопками дат, сохраняя однодневный маршрут', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  const dateControl = screen.getByLabelText('Выбрать любую дату') as HTMLInputElement;

  await user.click(screen.getByRole('button', { name: '27.07.2026' }));
  expect(getMapTrackState().trackDate).toBe('2026-07-27');

  await user.click(screen.getByRole('button', { name: '29.07.2026' }));
  expect(dateControl.value).toBe('2026-07-29');

  await user.click(screen.getByRole('button', { name: '28.07.2026' }));
  expect(dateControl.value).toBe('2026-07-28');

  expect(screen.getByRole('button', { name: '28.07.2026' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(screen.queryByRole('button', { name: '7 дней' })).toBeNull();
  await user.click(screen.getByRole('button', { name: '27.07.2026' }));
  expect(getMapTrackState().trackPeriod).toBe('day');
  expect(getMapTrackState().tripCount).toBe('1');
});

it('предпросматривает событие по hover/focus без активации и закрывает preview по leave/blur', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  const eventButton = screen.getByRole('button', {
    name: /Заправка, 29\.07\.2026, 08:32/,
  });
  const initialPlaybackPoint = getMapTrackState().playbackPoint;

  expect(eventButton.closest('[aria-label="События маршрута"]')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Потеря связи, 29\.07\.2026, 08:32/ })).toBeTruthy();
  fireEvent.mouseEnter(eventButton);
  expect(getMapTrackState().previewedEvent).toContain('-refuel');
  expect(getMapTrackState().selectedEvent).toBe('');
  expect(getMapTrackState().playbackPoint).toBe(initialPlaybackPoint);

  fireEvent.mouseLeave(eventButton);
  expect(getMapTrackState().previewedEvent).toBe('');
  fireEvent.focus(eventButton);
  expect(getMapTrackState().previewedEvent).toContain('-refuel');
  expect(getMapTrackState().selectedEvent).toBe('');
  fireEvent.blur(eventButton);
  expect(getMapTrackState().previewedEvent).toBe('');

  await user.click(eventButton);
  expect(getMapTrackState().selectedEvent).toContain('-refuel');
  expect(getMapTrackState().playbackPoint).toContain('-p4');
});

it('не останавливает autoplay при preview события', () => {
  vi.useFakeTimers();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести маршрут' }));
  act(() => vi.advanceTimersByTime(250));
  const eventButton = screen.getByRole('button', {
    name: /Заправка, 29\.07\.2026, 08:32/,
  });
  fireEvent.mouseEnter(eventButton);

  const progressAfterFirstFrame = Number((screen.getByRole('slider') as HTMLInputElement).value);
  expect(progressAfterFirstFrame).toBeGreaterThan(0);
  expect(progressAfterFirstFrame).toBeLessThan(1);
  expect(getMapTrackState().selectedEvent).toBe('');
  act(() => vi.advanceTimersByTime(250));
  expect(Number((screen.getByRole('slider') as HTMLInputElement).value)).toBeGreaterThan(
    progressAfterFirstFrame,
  );
});

it('показывает объединённые участки с focus-preview только выбранного дня', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  const segments = screen.getByRole('region', { name: 'Участки маршрута' });
  const firstSegment = screen.getByRole('button', {
    name: /Движение 29\.07\.2026, 08:00–08:48/,
  });

  expect(segments.querySelectorAll('button')).toHaveLength(4);
  expect(screen.getByRole('button', { name: /^Старт поездки 29\.07\.2026,/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Финиш поездки 29\.07\.2026,/ })).toBeTruthy();
  fireEvent.focus(firstSegment);
  expect(getMapTrackState().previewedSegment).toContain('2026-07-29');
  fireEvent.blur(firstSegment);
  expect(getMapTrackState().previewedSegment).toBe('');

  await user.click(screen.getByRole('button', { name: '28.07.2026' }));
  expect(segments.querySelectorAll('button')).toHaveLength(4);
  expect(screen.getByRole('button', { name: /^Старт поездки 28\.07\.2026,/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Финиш поездки 28\.07\.2026,/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Заправка, 29.07.2026, 08:32' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Заправка, 28.07.2026, 08:32' })).toBeTruthy();
});

it('показывает объединённые состояния и снимает выбор повторным нажатием', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  const movement = screen.getByRole('button', {
    name: /Движение 29\.07\.2026, 08:00–08:48/,
  });

  expect(screen.getAllByText('Движение').length).toBeGreaterThan(0);
  expect(
    movement.querySelector(
      'span[aria-hidden="true"][class*="inset-y-0"][class*="left-0"][class*="w-1"]',
    ),
  ).toBeNull();
  await user.click(movement);
  expect(getMapTrackState().previewedSegment).toContain('2026-07-29');
  expect(movement.getAttribute('aria-pressed')).toBe('true');
  await user.click(movement);
  expect(getMapTrackState().previewedSegment).toBe('');
  expect(movement.getAttribute('aria-pressed')).toBe('false');
});

it('позволяет свернуть мобильную карточку и не перекрывает карту playback-панелью', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  const panel = screen.getByTestId('selected-vehicle-panel');
  expect(panel.getAttribute('data-mobile-collapsed')).toBe('false');
  expect(panel.className).toContain('max-h-[38dvh]');
  expect(screen.getByTestId('track-playback-dock').className).toContain('hidden');

  await user.click(screen.getByRole('button', { name: 'Свернуть карточку автомобиля' }));
  expect(panel.getAttribute('data-mobile-collapsed')).toBe('true');
});

it('переключает playback на старую поездку через её старт и финиш', () => {
  vi.useFakeTimers();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  fireEvent.click(screen.getByRole('button', { name: '28.07.2026' }));
  const slider = screen.getByRole('slider', {
    name: 'Положение на маршруте',
  }) as HTMLInputElement;
  const olderStart = screen.getByRole('button', {
    name: /^Старт поездки 28\.07\.2026, 08:00,/,
  });
  const olderFinish = screen.getByRole('button', {
    name: /^Финиш поездки 28\.07\.2026, 08:56,/,
  });

  fireEvent.click(olderStart);
  expect(slider.value).toBe('0');
  expect(getMapTrackState().playbackPoint).toContain('2026-07-28-p0');

  fireEvent.change(slider, { target: { value: '50' } });
  expect(getMapTrackState().playbackPoint).toContain('playback');

  fireEvent.click(olderFinish);
  expect(slider.value).toBe('100');
  expect(getMapTrackState().playbackPoint).toContain('2026-07-28-p7');

  fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести маршрут' }));
  act(() => vi.advanceTimersByTime(1_000));
  expect(Number(slider.value)).toBeGreaterThan(0);
  expect(Number(slider.value)).toBeLessThan(1);
  expect(getMapTrackState().playbackPoint).toContain('playback');

  fireEvent.click(screen.getByRole('button', { name: '29.07.2026' }));
  expect(slider.value).toBe('0');
  expect(getMapTrackState().playbackPoint).toContain('2026-07-29-p0');
});

it('сбрасывает выбранную playback-поездку при смене даты и автомобиля', () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  fireEvent.click(screen.getByRole('button', { name: '28.07.2026' }));
  fireEvent.click(
    screen.getByRole('button', {
      name: /^Старт поездки 28\.07\.2026, 08:00,/,
    }),
  );
  expect(getMapTrackState().playbackPoint).toContain('2026-07-28-p0');

  fireEvent.change(screen.getByLabelText('Выбрать любую дату'), {
    target: { value: '2026-07-27' },
  });
  expect(getMapTrackState().trackPeriod).toBe('day');
  expect(getMapTrackState().playbackPoint).toContain('2026-07-27-p0');

  fireEvent.click(screen.getByRole('button', { name: '28.07.2026' }));
  fireEvent.click(
    screen.getByRole('button', {
      name: /^Старт поездки 28\.07\.2026, 08:00,/,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль В 456 КХ 178' }));
  expect(getMapTrackState().playbackPoint).toContain('haval-jolion-v456kh178-2026-07-29-p0');
});

it('показывает в сводке количество стоянок вместо количества событий', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));

  expect(screen.getByText('Стоянки')).toBeTruthy();
  expect(screen.queryByText('События')).toBeNull();
});

it('синхронизирует выбранное событие с ползунком и картой', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  await user.click(screen.getByRole('button', { name: 'Выбрать событие Заправка' }));

  const slider = screen.getByRole('slider', {
    name: 'Положение на маршруте',
  }) as HTMLInputElement;
  expect(Number(slider.value)).toBeCloseTo((4 / 7) * 100);
  expect(getMapTrackState().selectedEvent).toContain('-refuel');
  expect(getMapTrackState().playbackPoint).toContain('-p4');
});

it('обновляет положение вручную и автоматически до остановки', async () => {
  vi.useFakeTimers();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  const slider = screen.getByRole('slider', {
    name: 'Положение на маршруте',
  }) as HTMLInputElement;

  fireEvent.change(slider, { target: { value: '50' } });
  expect(slider.value).toBe('50');
  expect(getMapTrackState().playbackPoint).toContain('playback');

  fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести маршрут' }));
  act(() => vi.advanceTimersByTime(250));
  expect(Number(slider.value)).toBeGreaterThan(50);
  expect(Number(slider.value)).toBeLessThan(51);

  fireEvent.change(slider, { target: { value: '99.9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Скорость 30x' }));
  fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести маршрут' }));
  act(() => vi.advanceTimersByTime(1_000));
  expect(slider.value).toBe('100');
  expect(screen.getByRole('button', { name: 'Воспроизвести маршрут' })).toBeTruthy();
  act(() => vi.advanceTimersByTime(500));
  expect(slider.value).toBe('100');
});

it('сбрасывает воспроизведение при смене даты, автомобиля и закрытии панели', () => {
  vi.useFakeTimers();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));
  fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести маршрут' }));
  act(() => vi.advanceTimersByTime(500));
  expect(Number((screen.getByRole('slider') as HTMLInputElement).value)).toBeGreaterThan(0);

  fireEvent.change(screen.getByLabelText('Выбрать любую дату'), {
    target: { value: '2026-07-28' },
  });
  expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0');
  expect(screen.getByRole('button', { name: 'Воспроизвести маршрут' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Выбрать событие Заправка' }));
  expect(getMapTrackState().selectedEvent).toContain('-refuel');
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать автомобиль В 456 КХ 178' }));
  expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0');
  expect((screen.getByLabelText('Выбрать любую дату') as HTMLInputElement).value).toBe(
    '2026-07-29',
  );
  expect(getMapTrackState().selectedEvent).toBe('');

  fireEvent.click(screen.getByRole('button', { name: 'Закрыть карточку автомобиля' }));
  expect(getMapTrackState().vehicleId).toBe('');
  expect(getMapTrackState().playbackPoint).toBe('');
  expect(screen.queryByLabelText('Положение на маршруте')).toBeNull();
  act(() => vi.advanceTimersByTime(500));
  expect(getMapTrackState().playbackPoint).toBe('');
});

it('оставляет ручной ползунок активным при сокращённой анимации', () => {
  const onProgressChange = vi.fn();
  const onPlayingChange = vi.fn();

  render(
    <TrackPlayback
      progress={0}
      playing={false}
      reducedMotion
      onProgressChange={onProgressChange}
      onPlayingChange={onPlayingChange}
    />,
  );

  const playButton = screen.getByRole('button', {
    name: 'Воспроизвести маршрут',
    description: 'Сокращение анимации включено: используйте ползунок вручную.',
  });
  const slider = screen.getByRole('slider', {
    name: 'Положение на маршруте',
  }) as HTMLInputElement;
  expect(playButton.hasAttribute('disabled')).toBe(false);
  expect(playButton.getAttribute('aria-disabled')).toBe('true');
  expect(slider.hasAttribute('disabled')).toBe(false);

  fireEvent.click(playButton);
  expect(onPlayingChange).not.toHaveBeenCalled();
  fireEvent.change(slider, { target: { value: '35' } });
  expect(onProgressChange).toHaveBeenCalledWith(35);
});

it('показывает русское пустое состояние для дня без поездок', () => {
  render(<TrackDaySummary model={null} />);

  expect(screen.getByText('Маршрут за выбранный день не записан')).toBeTruthy();
  expect(
    screen.getByText('Выберите другой день или проверьте поступление данных ГЛОНАСС.'),
  ).toBeTruthy();
});
