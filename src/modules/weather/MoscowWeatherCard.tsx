import { FiCloud, FiCloudRain } from 'react-icons/fi';
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
    <section aria-label="Погода в Москве" className="min-w-0 rounded-[var(--radius-panel)] border border-slate-300/70 bg-gradient-to-br from-slate-700 to-slate-500 p-4 text-white shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-200">Москва · погода</p>
        {weather ? <FiCloudRain aria-hidden="true" className="size-4 shrink-0 text-slate-200" /> : <FiCloud aria-hidden="true" className="size-4 shrink-0 text-slate-300" />}
      </div>
      {weather ? <>
        <p className="mt-3 truncate text-2xl font-bold tracking-tight">{degrees(weather.temperatureC)}</p>
        <p className="mt-1 truncate text-[11px] text-slate-200">{description(weather.weatherCode)} · {weather.windSpeedMs.toFixed(1)} м/с</p>
      </> : <p className="mt-3 text-sm font-semibold">Погода временно недоступна</p>}
    </section>
  );
}
