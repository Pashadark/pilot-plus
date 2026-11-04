import { describe, expect, it } from 'vitest';
import { getMoscowWeather, parseOpenMeteoWeather } from './get-moscow-weather';

describe('parseOpenMeteoWeather', () => {
  it('normalizes current Moscow weather', () => {
    expect(
      parseOpenMeteoWeather({
        current: {
          time: '2026-08-26T01:30',
          temperature_2m: 17.4,
          apparent_temperature: 16.1,
          weather_code: 61,
          wind_speed_10m: 5.2,
          precipitation: 0.4,
        },
        daily: {
          sunrise: ['2026-08-26T05:08'],
          sunset: ['2026-08-26T19:48'],
        },
      }),
    ).toEqual({
      observedAt: '2026-08-26T01:30',
      temperatureC: 17.4,
      apparentTemperatureC: 16.1,
      weatherCode: 61,
      windSpeedMs: 5.2,
      precipitationMm: 0.4,
      sunrise: '2026-08-26T05:08',
      sunset: '2026-08-26T19:48',
    });
  });

  it('rejects incomplete provider data', () => {
    expect(parseOpenMeteoWeather({ current: { temperature_2m: 17 } })).toBeNull();
  });
});

describe('getMoscowWeather', () => {
  it('does not hold the dashboard open when the weather provider stalls', async () => {
    const stalledFetch = () => new Promise<Response>(() => undefined);
    const startedAt = performance.now();

    const weather = await getMoscowWeather({ fetcher: stalledFetch, timeoutMs: 20 });

    expect(weather).toBeNull();
    expect(performance.now() - startedAt).toBeLessThan(200);
  });
});
