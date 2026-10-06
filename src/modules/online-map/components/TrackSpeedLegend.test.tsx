// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { TrackSpeedLegend } from './TrackSpeedLegend';

afterEach(cleanup);

it('объясняет все четыре диапазона скорости числами, а не только цветом', () => {
  render(<TrackSpeedLegend />);

  expect(screen.getByLabelText('Шкала скорости маршрута')).toBeTruthy();
  expect(screen.getByText('0–39')).toBeTruthy();
  expect(screen.getByText('40–69')).toBeTruthy();
  expect(screen.getByText('70–99')).toBeTruthy();
  expect(screen.getByText('100+ км/ч')).toBeTruthy();
});
