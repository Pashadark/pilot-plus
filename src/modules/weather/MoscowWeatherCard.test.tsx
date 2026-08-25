// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MoscowWeatherCard } from './MoscowWeatherCard';

describe('MoscowWeatherCard', () => {
  afterEach(cleanup);

  it('renders strict real weather details without decorative transforms', () => {
    const { container } = render(<MoscowWeatherCard weather={{
      observedAt: '2026-08-26T01:30', temperatureC: 17.4, apparentTemperatureC: 16.1,
      weatherCode: 61, windSpeedMs: 5.2, precipitationMm: 0.4,
    }} />);
    expect(screen.getByText(/Москва/)).toBeTruthy();
    expect(screen.getByText('+17°')).toBeTruthy();
    expect(screen.getByText(/Дождь/)).toBeTruthy();
    expect(container.innerHTML).not.toContain('transform:');
  });

  it('does not break the dashboard when weather is unavailable', () => {
    render(<MoscowWeatherCard weather={null} />);
    expect(screen.getByText('Погода временно недоступна')).toBeTruthy();
  });
});
