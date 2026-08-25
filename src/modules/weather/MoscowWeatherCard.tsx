import { FiCloud, FiCloudRain, FiWind } from 'react-icons/fi';
import type { MoscowWeather } from './server/get-moscow-weather';

function description(code: number) {
  if (code === 0) return 'Ясно';
  if (code <= 3) return 'Облачно';
  if (code >= 51 && code <= 67) return 'Дождь';
  if (code >= 71 && code <= 77) return 'Снег';
  if (code >= 80 && code <= 82) return 'Ливень';
  if (code >= 95) return 'Гроза';
  return 'Переменная облачность';
}

function degrees(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}°`;
}

export function MoscowWeatherCard({ weather }: { weather: MoscowWeather | null }) {
  return (
    <section aria-label="Погода в Москве" className="rounded-[var(--radius-panel)] border border-slate-300/70 bg-gradient-to-br from-slate-700 to-slate-500 p-5 text-white shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-200">Москва · сейчас</p>
          {weather ? (
            <div className="mt-2 flex items-end gap-3">
              <p className="text-4xl font-bold tracking-tight">{degrees(weather.temperatureC)}</p>
              <p className="pb-1 text-sm text-slate-200">{description(weather.weatherCode)}</p>
            </div>
          ) : <p className="mt-2 text-lg font-semibold">Погода временно недоступна</p>}
        </div>
        {weather ? <FiCloudRain aria-hidden="true" className="size-9 text-slate-200" /> : <FiCloud aria-hidden="true" className="size-9 text-slate-300" />}
      </div>
      {weather && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/20 pt-3 text-sm text-slate-100">
          <span>Ощущается {degrees(weather.apparentTemperatureC)}</span>
          <span className="inline-flex items-center gap-1.5"><FiWind aria-hidden="true" />{weather.windSpeedMs.toFixed(1)} м/с</span>
          <span>Осадки {weather.precipitationMm.toFixed(1)} мм</span>
          <time className="text-slate-300">Обновлено {weather.observedAt.slice(11)}</time>
        </div>
      )}
    </section>
  );
}
