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
