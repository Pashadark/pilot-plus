// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkdayFleetCalendar } from './WorkdayFleetCalendar';
import type { DashboardFleetVehicle } from './overview-types';
afterEach(cleanup);
const fleet: DashboardFleetVehicle[] = [
  {
    id: 'car-1',
    name: 'Skoda Octavia',
    plate: 'TEST',
    image: null,
    position: null,
    rentals: [
      {
        id: 'rental-1',
        startsAt: '2026-10-08T09:00:00Z',
        endsAt: '2026-10-10T09:00:00Z',
        clientName: 'Иванов Иван',
        status: 'ACTIVE',
      },
    ],
  },
];
describe('WorkdayFleetCalendar', () => {
  it('keeps real rental links and changes periods without inventing bookings', () => {
    render(<WorkdayFleetCalendar fleet={fleet} selected="2026-10-08" />);
    expect(screen.getByRole('link', { name: 'Иванов Иван' }).getAttribute('href')).toBe(
      '/rentals/rental-1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Следующий период занятости' }));
    expect(screen.queryByRole('link', { name: 'Иванов Иван' })).toBeNull();
    expect(screen.getByText('Нет аренд в этом периоде')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий период занятости' }));
    expect(screen.getByRole('link', { name: 'Иванов Иван' })).toBeTruthy();
  });
  it('allows all vehicles to be expanded and collapsed', () => {
    render(
      <WorkdayFleetCalendar
        fleet={Array.from({ length: 5 }, (_, i) => ({
          ...fleet[0],
          id: `car-${i}`,
          name: `Авто ${i}`,
          rentals: [],
        }))}
        selected="2026-10-08"
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Все автомобили (5)' }));
    expect(screen.getAllByRole('link')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть список' }));
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });
});
