// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RentalCalendar } from './RentalCalendar';

describe('RentalCalendar', () => {
  afterEach(cleanup);
  it('renders an accessible month grid and a mobile agenda with vehicle and client', () => {
    render(
      <RentalCalendar
        month="2026-08"
        rentals={[
          {
            id: 'rental-1',
            startsAt: '2026-08-20T09:00:00.000Z',
            endsAt: '2026-08-22T09:00:00.000Z',
            status: 'CONFIRMED',
            vehicleLabel: 'BMW X5 · А 123 МР 77',
            clientLabel: 'Иванов Иван',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('rental-calendar-grid')).toBeTruthy();
    expect(screen.getByTestId('rental-calendar-agenda').textContent).toContain('BMW X5');
    expect(screen.getByTestId('rental-calendar-agenda').textContent).toContain('Иванов Иван');
  });

  it('renders full Moscow month weeks and only half-open overlapping rentals per day', () => {
    render(
      <RentalCalendar
        month="2026-08"
        rentals={[
          {
            id: 'multi',
            startsAt: '2026-08-30T21:00:00.000Z',
            endsAt: '2026-09-02T21:00:00.000Z',
            status: 'CONFIRMED',
            vehicleLabel: 'Polo',
            clientLabel: 'Иванов',
          },
          {
            id: 'outside',
            startsAt: '2026-09-01T00:00:00.000Z',
            endsAt: '2026-09-02T00:00:00.000Z',
            status: 'CONFIRMED',
            vehicleLabel: 'Не показывать',
            clientLabel: 'Иванов',
          },
          {
            id: 'boundary',
            startsAt: '2026-08-31T21:00:00.000Z',
            endsAt: '2026-08-31T21:00:00.001Z',
            status: 'CONFIRMED',
            vehicleLabel: 'Одни сутки',
            clientLabel: 'Петров',
          },
        ]}
      />,
    );

    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.getAllByRole('gridcell')[5]?.getAttribute('aria-label')).toMatch(/^1 августа/u);
    expect(screen.getByRole('gridcell', { name: /31 августа.*Polo/u })).toBeTruthy();
    expect(screen.queryByText('Не показывать')).toBeNull();
    expect(screen.getByTestId('rental-calendar-agenda').textContent).toContain('Polo');
    expect(screen.getByTestId('rental-calendar-agenda').textContent).not.toContain('Не показывать');
  });
});
