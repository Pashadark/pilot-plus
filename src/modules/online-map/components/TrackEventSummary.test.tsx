// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import type { VehicleTrackPeriodViewModel } from '../track-types';
import { TrackEventSummary } from './TrackEventSummary';

it('показывает компактные счётчики основных событий маршрута', () => {
  const model = {
    events: [
      { type: 'speeding' },
      { type: 'speeding' },
      { type: 'harsh-acceleration' },
      { type: 'harsh-braking' },
      { type: 'stop' },
      { type: 'stop' },
      { type: 'stop' },
    ],
  } as unknown as VehicleTrackPeriodViewModel;

  render(<TrackEventSummary model={model} />);

  const summary = screen.getByRole('region', { name: 'Сводка событий маршрута' });
  expect(summary.textContent).toContain('2Превышения');
  expect(summary.textContent).toContain('1Разгоны');
  expect(summary.textContent).toContain('1Торможения');
  expect(summary.textContent).toContain('3Остановки');
});
