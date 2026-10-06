// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { onlineMapVehicles } from '../fixtures';
import { VehicleMapMarker } from './VehicleMapMarker';

afterEach(cleanup);

it('показывает госномер и позволяет выбрать автомобиль с клавиатуры', async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();

  render(<VehicleMapMarker vehicle={onlineMapVehicles[0]} selected={false} onSelect={onSelect} />);

  const marker = screen.getByRole('button', { name: /А 123 МР 77/ });
  await user.tab();

  expect(document.activeElement).toBe(marker);

  await user.keyboard('{Enter}');

  expect(onSelect).toHaveBeenCalledWith(onlineMapVehicles[0]);
});

it('показывает в карточке скорость, топливо и время последнего сигнала', () => {
  render(<VehicleMapMarker vehicle={onlineMapVehicles[0]} selected={false} onSelect={vi.fn()} />);

  const marker = screen.getByRole('button', { name: /А 123 МР 77/ });
  expect(marker.textContent).toContain('Скорость: 48 км/ч');
  expect(marker.textContent).toContain('Топливо: 72%');
  expect(marker.textContent).toContain('Последний сигнал: только что');
});

it('не показывает пустой процент, если топливо не передано', () => {
  render(
    <VehicleMapMarker
      vehicle={{ ...onlineMapVehicles[0], fuelPercent: null }}
      selected
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByRole('button').textContent).toContain('Топливо: Нет данных');
  expect(screen.getByRole('button').textContent).not.toContain('Топливо: %');
});

it('показывает компактную угловую стрелку по направлению движения', () => {
  render(
    <VehicleMapMarker
      vehicle={{ ...onlineMapVehicles[0], heading: 127 }}
      selected={true}
      onSelect={vi.fn()}
    />,
  );

  const glyph = screen.getByTestId('vehicle-map-arrow');
  expect(glyph.getAttribute('data-heading')).toBe('127');
  expect(glyph.getAttribute('style')).toContain('rotate(127deg)');
  expect(glyph.querySelector('svg path')?.getAttribute('d')).toBe('M16 1 29 31 16 25 3 31Z');
  expect(screen.queryByTestId('vehicle-map-car')).toBeNull();
  expect(glyph.className).toContain('--color-primary');
});

it('показывает устаревший GPS-сигнал красным с явной причиной', () => {
  const staleVehicle = {
    ...onlineMapVehicles[3],
    gpsStatus: {
      key: 'STALE',
      label: 'Давно не обновлялся',
      tone: 'danger',
      isConnected: false,
    },
  } as unknown as (typeof onlineMapVehicles)[number];

  render(<VehicleMapMarker vehicle={staleVehicle} selected={false} onSelect={vi.fn()} />);

  expect(screen.getByTestId('vehicle-map-arrow').className).toContain('--color-danger');
  expect(screen.getByText(/Kia K5 · Давно не обновлялся/)).toBeTruthy();
});
