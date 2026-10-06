// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FuelLevelBar } from './FuelLevelBar';

afterEach(cleanup);

describe('FuelLevelBar', () => {
  it('shows the percentage inside an accessible compact progress bar', () => {
    render(<FuelLevelBar value={55} />);

    const progress = screen.getByRole('progressbar', { name: 'Уровень топлива' });
    expect(progress.getAttribute('aria-valuenow')).toBe('55');
    expect(progress.textContent).toContain('55%');
    expect(screen.getByTestId('fuel-level-fill').style.backgroundColor).toBeTruthy();
    expect(screen.getByTestId('fuel-level-fill').parentElement?.className).toContain('h-1.5');
  });

  it('uses danger and success colors at the low and full ends of the scale', () => {
    const { rerender } = render(<FuelLevelBar value={20} />);
    const low = screen.getByTestId('fuel-level-fill').style.backgroundColor;

    rerender(<FuelLevelBar value={80} />);
    expect(screen.getByTestId('fuel-level-fill').style.backgroundColor).not.toEqual(low);
  });

  it('shows a neutral empty state when fuel data is unavailable', () => {
    render(<FuelLevelBar value={null} />);

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Нет данных')).toBeTruthy();
  });
});
