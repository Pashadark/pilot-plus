// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RentalCalendar } from './RentalCalendar';

describe('RentalCalendar', () => {
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
});
