import 'server-only';

export type MoscowWeather = {
  observedAt: string;
  temperatureC: number;
  apparentTemperatureC: number;
  weatherCode: number;
  windSpeedMs: number;
  precipitationMm: number;
  sunrise?: string;
  sunset?: string;
};

export function parseOpenMeteoWeather(value: unknown): MoscowWeather | null {
  if (!value || typeof value !== 'object') return null;
  const current = (value as { current?: unknown }).current;
  if (!current || typeof current !== 'object') return null;
  const row = current as Record<string, unknown>;
  const numbers = [
    'temperature_2m',
    'apparent_temperature',
    'weather_code',
    'wind_speed_10m',
    'precipitation',
  ] as const;
  if (typeof row.time !== 'string' || numbers.some((key) => typeof row[key] !== 'number'))
    return null;
  const daily = (value as { daily?: unknown }).daily;
  const dailyRow = daily && typeof daily === 'object' ? (daily as Record<string, unknown>) : null;
  const sunrise = Array.isArray(dailyRow?.sunrise) ? dailyRow.sunrise[0] : undefined;
  const sunset = Array.isArray(dailyRow?.sunset) ? dailyRow.sunset[0] : undefined;
  return {
    observedAt: row.time,
    temperatureC: row.temperature_2m as number,
    apparentTemperatureC: row.apparent_temperature as number,
    weatherCode: row.weather_code as number,
    windSpeedMs: row.wind_speed_10m as number,
    precipitationMm: row.precipitation as number,
    ...(typeof sunrise === 'string' ? { sunrise } : {}),
    ...(typeof sunset === 'string' ? { sunset } : {}),
  };
}

export async function getMoscowWeather(): Promise<MoscowWeather | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', '55.7558');
  url.searchParams.set('longitude', '37.6176');
  url.searchParams.set('timezone', 'Europe/Moscow');
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
  );
  url.searchParams.set('daily', 'sunrise,sunset');
  try {
    const response = await fetch(url, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return parseOpenMeteoWeather(await response.json());
  } catch {
    return null;
  }
}
