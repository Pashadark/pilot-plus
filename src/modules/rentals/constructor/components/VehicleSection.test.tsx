// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VehicleSection } from './VehicleSection';

afterEach(cleanup);

const vehicle = {
  id: 'vehicle-1',
  label: 'Toyota Camry Р957АН997',
  dailyMinor: 300000,
  depositMinor: 1500000,
  registrationNumber: 'Р957АН997',
  imageUrl: null,
  available: true,
  reasons: [],
  legalReady: true,
  rentalIntervals: [
    {
      startsAt: '2026-11-20T07:00:00.000Z',
      endsAt: '2026-11-22T07:00:00.000Z',
      status: 'ACTIVE',
    },
  ],
};

describe('VehicleSection', () => {
  it('shows a period overlap and reports the selected vehicle as unavailable', async () => {
    const selected = vi.fn();
    render(
      <VehicleSection
        vehicles={[vehicle]}
        selectedId={undefined}
        startsAt="2026-11-21T10:00"
        endsAt="2026-11-23T10:00"
        onSelected={selected}
      />,
    );

    expect(screen.getByText('Занят подтверждённой арендой')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Toyota Camry/ }));
    expect(selected).toHaveBeenCalledWith(vehicle, false);
  });
});
