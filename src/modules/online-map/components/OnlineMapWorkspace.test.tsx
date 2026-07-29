// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import type { OnlineFleetMapProps } from './OnlineFleetMap';
import { OnlineMapWorkspace } from './OnlineMapWorkspace';
import { TrackDaySummary } from './TrackDaySummary';
import { TrackPlayback } from './TrackPlayback';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function FakeMap(props: OnlineFleetMapProps) {
  const { vehicles, selectedVehicleId, onVehicleSelect, trackViewModel, onEventActivate } = props;
  return (
    <div aria-label="Тестовая карта">
      <output
        data-testid="map-track-state"
        data-vehicle-id={trackViewModel?.vehicleId ?? ''}
        data-track-date={trackViewModel?.date ?? ''}
        data-playback-point={props.playbackPoint?.id ?? ''}
        data-selected-event={props.selectedEventId ?? ''}
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

function getMapTrackState(): DOMStringMap {
  return (screen.getByTestId('map-track-state') as HTMLOutputElement).dataset;
}

it('ищет по модели и сбрасывает скрытый выбор без автоматического выбора первой машины', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(5);
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
  expect(screen.getByPlaceholderText('Поиск по модели или госномеру')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /К 111 МР 199/ }));
  expect(screen.getByRole('button', { name: /К 111 МР 199/ }).getAttribute('aria-pressed')).toBe(
    'true',
  );

  await user.type(screen.getByRole('searchbox', { name: 'Поиск транспорта' }), 'Lada Vesta');

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(1);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /А 123 МР 77/ }).getAttribute('aria-pressed')).toBe(
      'false',
    ),
  );
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
});

it('очищает выбор при пустом результате и позволяет сбросить фильтры без автовыбора', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.type(screen.getByRole('searchbox', { name: 'Поиск транспорта' }), 'Р 999');

  expect(screen.queryAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(0);
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
  expect(screen.getByText('По запросу ничего не найдено')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(5);
  expect(screen.getByRole('button', { name: /А 123 МР 77/ }).getAttribute('aria-pressed')).toBe(
    'false',
  );
});

it('закрывает мобильную панель в null и не выбирает машину до нового нажатия маркера', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  expect(screen.getByRole('link', { name: '© OpenStreetMap' })).toBeTruthy();
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();

  await user.click(screen.getByRole('button', { name: /В 456 КХ 178/ }));
  expect(
    screen.getByRole('complementary', { name: 'Выбранный автомобиль' }).querySelector('h2')
      ?.textContent,
  ).toBe('Haval Jolion');

  await user.click(screen.getByRole('button', { name: 'Закрыть карточку автомобиля' }));
  expect(screen.queryByRole('complementary', { name: 'Выбранный автомобиль' })).toBeNull();
  expect(screen.getByRole('button', { name: /В 456 КХ 178/ }).getAttribute('aria-pressed')).toBe(
    'false',
  );
  expect(screen.getByRole('link', { name: '© OpenStreetMap' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /Е 789 НО 77/ }));
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

  await user.click(screen.getByRole('button', { name: 'На стоянке' }));
  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(2);

  await user.click(screen.getByRole('button', { name: 'Нет связи' }));
  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(1);
  expect(screen.getByRole('button', { name: /К 111 МР 199/ })).toBeTruthy();
});

it('использует container responsive layout и сохраняет атрибуцию отдельно от панели', () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  const workspace = screen.getByRole('region', { name: 'Онлайн-карта транспорта' });
  expect(workspace.className).toContain('@container');
  expect(workspace.className).toContain(
    '[@media(max-height:42rem)]:[&_.maplibregl-ctrl-group]:hidden',
  );

  const attribution = screen.getByRole('link', { name: '© OpenStreetMap' });
  expect(attribution.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
  expect(attribution.closest('aside')).toBeNull();
});

it('центрирует desktop playback только в свободной от правой панели области карты', () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);
  fireEvent.click(screen.getByRole('button', { name: /А 123 МР 77/ }));

  const slider = screen.getByRole('slider', { name: 'Положение на маршруте' });
  const playbackPositioner = slider.parentElement?.parentElement;
  expect(playbackPositioner?.className).toContain('@min-[48rem]:left-[var(--sidebar-width)]');
  expect(playbackPositioner?.className).toContain('@min-[48rem]:right-[21rem]');
  expect(playbackPositioner?.className).toContain('@min-[48rem]:mx-auto');
  expect(playbackPositioner?.className).not.toContain(
    '@min-[48rem]:left-[calc((100vw+var(--sidebar-width))/2)]',
  );
  expect(slider.closest('aside')).toBeTruthy();
});

it('выбирает последнюю дату автомобиля и передаёт маршрут карте', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: /А 123 МР 77/ }));

  const dateControl = screen.getByLabelText('Дата маршрута') as HTMLSelectElement;
  expect(dateControl.value).toBe('2026-07-29');
  expect(screen.getByText('Сводка маршрута')).toBeTruthy();
  expect(getMapTrackState().vehicleId).toBe('lada-vesta-a123mr77');
  expect(getMapTrackState().playbackPoint).toContain('2026-07-29-p0');
});

it('меняет день и быстрый период, сохраняя доступные даты', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: /А 123 МР 77/ }));
  const dateControl = screen.getByLabelText('Дата маршрута') as HTMLSelectElement;

  await user.selectOptions(dateControl, '2026-07-27');
  expect(getMapTrackState().trackDate).toBe('2026-07-27');

  await user.click(screen.getByRole('button', { name: 'Сегодня' }));
  expect(dateControl.value).toBe('2026-07-29');

  await user.click(screen.getByRole('button', { name: 'Вчера' }));
  expect(dateControl.value).toBe('2026-07-28');

  await user.click(screen.getByRole('button', { name: '7 дней' }));
  expect(dateControl.value).toBe('2026-07-28');
  expect([...dateControl.options].map((option) => option.value)).toEqual([
    '2026-07-29',
    '2026-07-28',
    '2026-07-27',
  ]);
});

it('синхронизирует выбранное событие с ползунком и картой', async () => {
  const user = userEvent.setup();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.click(screen.getByRole('button', { name: /А 123 МР 77/ }));
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

  fireEvent.click(screen.getByRole('button', { name: /А 123 МР 77/ }));
  const slider = screen.getByRole('slider', {
    name: 'Положение на маршруте',
  }) as HTMLInputElement;

  fireEvent.change(slider, { target: { value: '50' } });
  expect(slider.value).toBe('50');
  expect(getMapTrackState().playbackPoint).toContain('-p4');

  fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести маршрут' }));
  act(() => vi.advanceTimersByTime(250));
  expect(Number(slider.value)).toBe(52);

  act(() => vi.advanceTimersByTime(6_000));
  expect(slider.value).toBe('100');
  expect(screen.getByRole('button', { name: 'Воспроизвести маршрут' })).toBeTruthy();
  act(() => vi.advanceTimersByTime(500));
  expect(slider.value).toBe('100');
});

it('сбрасывает воспроизведение при смене даты, автомобиля и закрытии панели', () => {
  vi.useFakeTimers();
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  fireEvent.click(screen.getByRole('button', { name: /А 123 МР 77/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести маршрут' }));
  act(() => vi.advanceTimersByTime(500));
  expect(Number((screen.getByRole('slider') as HTMLInputElement).value)).toBeGreaterThan(0);

  fireEvent.change(screen.getByLabelText('Дата маршрута'), {
    target: { value: '2026-07-28' },
  });
  expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0');
  expect(screen.getByRole('button', { name: 'Воспроизвести маршрут' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Выбрать событие Заправка' }));
  expect(getMapTrackState().selectedEvent).toContain('-refuel');
  fireEvent.click(screen.getByRole('button', { name: /В 456 КХ 178/ }));
  expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0');
  expect((screen.getByLabelText('Дата маршрута') as HTMLSelectElement).value).toBe('2026-07-29');
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

  expect(screen.getByText('За эту дату поездок нет')).toBeTruthy();
  expect(screen.getByText('Выберите другой день, чтобы посмотреть маршрут.')).toBeTruthy();
});
