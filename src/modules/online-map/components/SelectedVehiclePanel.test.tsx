// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/modules/maintenance/service-plan-actions', () => ({
  readServicePlan: vi.fn().mockResolvedValue({ canEdit: false, current: null, record: null }),
  saveServicePlan: vi.fn(),
}));

import { onlineMapVehicles } from '../fixtures';
import { SelectedVehiclePanel } from './SelectedVehiclePanel';

afterEach(cleanup);

it('keeps maintenance out of the map panel', () => {
  render(
    <SelectedVehiclePanel
      vehicle={onlineMapVehicles[0]}
      onClose={() => {}}
      trackControls={null}
      trackSummary={null}
      trackSegments={null}
      trackEvents={null}
    />,
  );
  expect(screen.queryByText('До следующего ТО')).toBeNull();
});

it('показывает фото, карточку машины и подтверждённые условия аренды', () => {
  const vehicle = {
    ...onlineMapVehicles[0],
    id: 'vehicle-rich',
    name: 'BMW 520d xDrive',
    plate: 'У891АВ797',
    image: { src: '/vehicles/vehicle-rich/images/image-main', alt: 'BMW 520d xDrive' },
    odometerKm: 1262.5,
    dailyDistanceKm: 50.3,
    currentRental: {
      id: 'rental-rich',
      clientId: 'client-rich',
      contractNumber: 'ME-2026-1102-KU',
      clientName: 'Кульпинёв Александр Витальевич',
      endsAt: '2026-11-12T12:00:00.000Z',
      dailyRateMinor: 360_000,
      currency: 'RUB',
      includedMileageKm: 400,
      depositState: 'COLLECTED',
    },
  } as const;

  render(
    <SelectedVehiclePanel
      vehicle={vehicle}
      onClose={vi.fn()}
      trackControls={null}
      trackSummary={null}
      trackSegments={null}
      trackEvents={null}
    />,
  );

  expect(screen.getByRole('img', { name: 'BMW 520d xDrive' })).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Открыть карточку автомобиля' }).getAttribute('href'),
  ).toBe('/vehicles/vehicle-rich');
  expect(screen.getByRole('link', { name: 'Открыть договор аренды' }).getAttribute('href')).toBe(
    '/rentals/rental-rich',
  );
  expect(screen.getByText('1 262,5 км')).toBeTruthy();
  expect(screen.getByText('3 600 ₽/сутки')).toBeTruthy();
  expect(screen.getByText('Залог внесён')).toBeTruthy();
});

it('показывает устаревший GPS-сигнал красной меткой и последним сигналом', () => {
  const vehicle = {
    ...onlineMapVehicles[3],
    gpsStatus: {
      key: 'STALE',
      label: 'Давно не обновлялся',
      tone: 'danger',
      isConnected: false,
    },
  } as unknown as (typeof onlineMapVehicles)[number];

  render(
    <SelectedVehiclePanel
      vehicle={vehicle}
      onClose={vi.fn()}
      trackControls={null}
      trackSummary={null}
      trackSegments={null}
      trackEvents={null}
    />,
  );

  const badge = screen.getByText('Давно не обновлялся');
  expect(badge.className).toContain('--color-danger');
  expect(screen.getByText('Последний сигнал: 18 минут назад')).toBeTruthy();
});
