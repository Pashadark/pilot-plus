// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { onlineMapVehicles } from '../fixtures';
import { VehicleMapMarker } from './VehicleMapMarker';

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
