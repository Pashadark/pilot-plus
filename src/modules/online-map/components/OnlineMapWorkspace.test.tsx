// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';

import type { OnlineFleetMapProps } from './OnlineFleetMap';
import { OnlineMapWorkspace } from './OnlineMapWorkspace';

afterEach(cleanup);

function FakeMap({ vehicles, selectedVehicleId, onVehicleSelect }: OnlineFleetMapProps) {
  return (
    <div aria-label="Тестовая карта">
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
    </div>
  );
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

  await user.click(screen.getByRole('button', { name: 'Закрыть панель автомобиля' }));
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
