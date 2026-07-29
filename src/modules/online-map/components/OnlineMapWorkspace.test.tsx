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

it('фильтрует пять тестовых машин и сбрасывает скрытый выбор', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(5);

  await user.click(screen.getByRole('button', { name: /К 111 МР 199/ }));
  expect(screen.getByRole('button', { name: /К 111 МР 199/ }).getAttribute('aria-pressed')).toBe(
    'true',
  );

  await user.type(screen.getByRole('searchbox', { name: 'Поиск транспорта' }), 'А 123');

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(1);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /А 123 МР 77/ }).getAttribute('aria-pressed')).toBe(
      'true',
    ),
  );
});

it('очищает выбор при пустом результате и позволяет сбросить фильтры', async () => {
  const user = userEvent.setup();

  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  await user.type(screen.getByRole('searchbox', { name: 'Поиск транспорта' }), 'Р 999');

  expect(screen.queryAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(0);
  expect(screen.getByText('Автомобиль не выбран')).toBeTruthy();
  expect(screen.getByText('По запросу ничего не найдено')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));

  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(5);
  expect(screen.getByRole('button', { name: /А 123 МР 77/ }).getAttribute('aria-pressed')).toBe(
    'true',
  );
});

it('скрывает навигацию на низком экране и сохраняет доступную атрибуцию карты', () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);

  const workspace = screen.getByRole('region', { name: 'Онлайн-карта транспорта' });
  expect(workspace.className).toContain(
    '[@media(max-height:42rem)]:[&_.maplibregl-ctrl-group]:hidden',
  );

  const attribution = screen.getByRole('link', { name: '© OpenStreetMap' });
  expect(attribution.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
});
