// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MoscowWeatherCard } from './MoscowWeatherCard';

describe('MoscowWeatherCard', () => {
  afterEach(cleanup);

  it('renders a rainy night scene from real weather details', () => {
    const { container } = render(
      <MoscowWeatherCard
        weather={{
          observedAt: '2026-08-26T01:30',
          temperatureC: 17.4,
          apparentTemperatureC: 16.1,
          weatherCode: 61,
          windSpeedMs: 5.2,
          precipitationMm: 0.4,
          sunrise: '2026-08-26T05:08',
          sunset: '2026-08-26T19:48',
        }}
      />,
    );
    expect(screen.getByText(/Москва/)).toBeTruthy();
    expect(screen.getByText('+17°')).toBeTruthy();
    expect(screen.getByText(/Дождь/)).toBeTruthy();
    expect(container.querySelector('[data-weather-scene="rain-night"]')).toBeTruthy();
    expect(container.querySelector('[data-weather-icon]')?.getAttribute('src')).toContain(
      '/weather/meteocons/rain.svg',
    );
    expect(screen.getByLabelText('Погода в Москве').className).toContain('p-4');
    expect(screen.getByLabelText('Погода в Москве').className).not.toContain('p-5');
  });

  it.each([
    ['2026-08-26T05:18', 0, 'sunrise'],
    ['2026-08-26T13:00', 0, 'clear-day'],
    ['2026-08-26T19:38', 0, 'sunset'],
    ['2026-08-26T23:00', 0, 'clear-night'],
    ['2026-08-26T13:00', 73, 'snow-day'],
    ['2026-08-26T23:00', 95, 'thunder-night'],
  ])('selects the %s scene', (observedAt, weatherCode, expectedScene) => {
    const { container } = render(
      <MoscowWeatherCard
        weather={{
          observedAt,
          temperatureC: 12,
          apparentTemperatureC: 11,
          weatherCode,
          windSpeedMs: 2,
          precipitationMm: 0,
          sunrise: '2026-08-26T05:08',
          sunset: '2026-08-26T19:48',
        }}
      />,
    );
    expect(container.querySelector(`[data-weather-scene="${expectedScene}"]`)).toBeTruthy();
  });

  it('does not break the dashboard when weather is unavailable', () => {
    render(<MoscowWeatherCard weather={null} />);
    expect(screen.getByText('Погода временно недоступна')).toBeTruthy();
  });

  it('uses professional animated day and night artwork for cloud cover', () => {
    const { container, rerender } = render(
      <MoscowWeatherCard
        weather={{
          observedAt: '2026-08-26T13:00',
          temperatureC: 20,
          apparentTemperatureC: 20,
          weatherCode: 2,
          windSpeedMs: 1,
          precipitationMm: 0,
          sunrise: '2026-08-26T05:08',
          sunset: '2026-08-26T19:48',
        }}
      />,
    );
    expect(container.querySelector('[data-weather-icon]')?.getAttribute('src')).toContain(
      '/weather/meteocons/partly-cloudy-day.svg',
    );

    rerender(
      <MoscowWeatherCard
        weather={{
          observedAt: '2026-08-26T23:00',
          temperatureC: 14,
          apparentTemperatureC: 13,
          weatherCode: 2,
          windSpeedMs: 1,
          precipitationMm: 0,
          sunrise: '2026-08-26T05:08',
          sunset: '2026-08-26T19:48',
        }}
      />,
    );
    expect(container.querySelector('[data-weather-icon]')?.getAttribute('src')).toContain(
      '/weather/meteocons/partly-cloudy-night.svg',
    );
  });
});
