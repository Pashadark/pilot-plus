import Image from 'next/image';
import { FiCloud } from 'react-icons/fi';
import type { MoscowWeather } from './server/get-moscow-weather';

type DayPhase = 'night' | 'sunrise' | 'day' | 'sunset';
type WeatherEffect = 'clear' | 'clouds' | 'fog' | 'rain' | 'snow' | 'thunder';

function minutes(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function dayPhase(weather: MoscowWeather): DayPhase {
  const now = minutes(weather.observedAt) ?? 12 * 60;
  const sunrise = minutes(weather.sunrise) ?? 6 * 60;
  const sunset = minutes(weather.sunset) ?? 19 * 60;
  if (Math.abs(now - sunrise) <= 35) return 'sunrise';
  if (Math.abs(now - sunset) <= 35) return 'sunset';
  if (now < sunrise - 35 || now > sunset + 35) return 'night';
  return 'day';
}

function weatherEffect(code: number): WeatherEffect {
  if (code >= 95) return 'thunder';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 1 && code <= 3) return 'clouds';
  return 'clear';
}

export function getWeatherScene(weather: MoscowWeather) {
  const phase = dayPhase(weather);
  const effect = weatherEffect(weather.weatherCode);
  return {
    phase,
    effect,
    name:
      effect === 'clear'
        ? phase === 'day'
          ? 'clear-day'
          : phase === 'night'
            ? 'clear-night'
            : phase
        : `${effect}-${phase}`,
  };
}

const backgrounds: Record<DayPhase, string> = {
  night: 'from-slate-950 via-indigo-950 to-slate-800',
  sunrise: 'from-indigo-700 via-rose-500 to-amber-300',
  day: 'from-sky-600 via-sky-500 to-cyan-300',
  sunset: 'from-indigo-800 via-fuchsia-600 to-orange-400',
};

export function weatherIcon(phase: DayPhase, effect: WeatherEffect) {
  const light = phase !== 'night';
  if (effect === 'clear') return light ? 'clear-day' : 'clear-night';
  if (effect === 'clouds') return light ? 'partly-cloudy-day' : 'partly-cloudy-night';
  if (effect === 'fog') return light ? 'fog-day' : 'fog-night';
  if (effect === 'thunder') return light ? 'thunderstorms-day' : 'thunderstorms-night';
  return effect;
}

export function weatherDescription(code: number) {
  if (code === 0) return 'Ясно';
  if (code <= 3) return 'Облачно';
  if (code >= 51 && code <= 67) return 'Дождь';
  if (code >= 71 && code <= 77) return 'Снег';
  if (code >= 80 && code <= 82) return 'Ливень';
  if (code >= 95) return 'Гроза';
  return 'Переменная облачность';
}

export function weatherDegrees(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}°`;
}

export function MoscowWeatherCard({ weather }: { weather: MoscowWeather | null }) {
  const scene = weather ? getWeatherScene(weather) : null;
  return (
    <section
      aria-label="Погода в Москве"
      data-weather-scene={scene?.name}
      className={`relative min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-white/20 bg-gradient-to-br p-4 text-white shadow-[var(--shadow-card)] ${scene ? backgrounds[scene.phase] : 'from-slate-700 to-slate-500'}`}
    >
      {scene ? (
        <Image
          alt=""
          aria-hidden="true"
          data-weather-icon
          src={`/weather/meteocons/${weatherIcon(scene.phase, scene.effect)}.svg`}
          width={112}
          height={112}
          unoptimized
          className="pointer-events-none absolute -right-2 -bottom-3 size-28 opacity-90 drop-shadow-xl motion-reduce:[&_*]:animate-none"
        />
      ) : null}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-200">Москва · погода</p>
        {!weather ? (
          <FiCloud aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
        ) : null}
      </div>
      {weather ? (
        <>
          <p className="relative z-10 mt-3 truncate text-2xl font-bold tracking-tight drop-shadow-sm">
            {weatherDegrees(weather.temperatureC)}
          </p>
          <p className="relative z-10 mt-1 truncate text-[11px] text-white/85">
            {weatherDescription(weather.weatherCode)} · {weather.windSpeedMs.toFixed(1)} м/с
          </p>
        </>
      ) : (
        <p className="relative z-10 mt-3 text-sm font-semibold">Погода временно недоступна</p>
      )}
    </section>
  );
}
