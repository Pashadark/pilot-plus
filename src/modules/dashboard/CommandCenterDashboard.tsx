import Link from 'next/link';
import { FiCalendar, FiPlus } from 'react-icons/fi';
import type { DashboardOverviewDto } from './overview-types';
import { AttentionPanel } from './AttentionPanel';
import { CommandCenterKpis } from './CommandCenterKpis';
import { WorkdayBoard } from './WorkdayBoard';
import { MoscowWeatherCard } from '@/modules/weather/MoscowWeatherCard';
import type { MoscowWeather } from '@/modules/weather/server/get-moscow-weather';

const periods = [
  ['today', 'Сегодня'],
  ['tomorrow', 'Завтра'],
  ['day-after-tomorrow', 'Послезавтра'],
  ['week', 'Неделя'],
] as const;

const quickActions = [
  ['/clients/new', 'Новый клиент'],
  ['/rentals/new', 'Новая аренда'],
  ['/maintenance', 'Поставить на ТО'],
  ['/wash', 'Отправить на мойку'],
] as const;

export function CommandCenterDashboard({ overview, weather = null }: { overview: DashboardOverviewDto; weather?: MoscowWeather | null }) {
  return (
    <div className="grid gap-4 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-primary)]">СУПА ПРО</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Командный центр</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Что нужно сделать и что нельзя пропустить
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Быстрые действия">
          {quickActions.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 text-sm font-semibold shadow-[var(--shadow-card)] hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              <FiPlus aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </header>

      <nav
        aria-label="Период командного центра"
        className="flex gap-1 overflow-x-auto rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-1"
      >
        <FiCalendar
          aria-hidden="true"
          className="m-2 size-4 shrink-0 text-[var(--color-text-secondary)]"
        />
        {periods.map(([key, label]) => (
          <Link
            key={key}
            href={`/?period=${key}`}
            aria-current={overview.period.key === key ? 'page' : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-[var(--radius-sm)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${overview.period.key === key ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)]' : 'hover:bg-[var(--color-elevated)]'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="order-1"><MoscowWeatherCard weather={weather} /></div>
      <div className="order-2 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="order-2 lg:order-1">
          <WorkdayBoard items={overview.workItems} />
        </div>
        <div className="order-1 lg:order-2">
          <AttentionPanel items={overview.attentionItems} />
        </div>
      </div>
      <div className="order-3">
        <CommandCenterKpis kpis={overview.kpis} />
      </div>
      <nav aria-label="Подробные разделы" className="order-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['/rentals', 'Все аренды'],
          ['/map', 'Карта машин'],
          ['/maintenance', 'Техобслуживание'],
          ['/wash', 'Мойки'],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 py-3 text-center text-sm font-semibold hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
