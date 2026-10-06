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
  render(<SelectedVehiclePanel vehicle={onlineMapVehicles[0]} onClose={() => {}} trackControls={null} trackSummary={null} trackSegments={null} trackEvents={null} />);
  expect(screen.queryByText('До следующего ТО')).toBeNull();
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
