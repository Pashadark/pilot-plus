import Link from 'next/link';
import { FiPlus } from 'react-icons/fi';
import type { DashboardOverviewDto } from './overview-types';
import { CommandCenterKpis } from './CommandCenterKpis';
import { DashboardDatePicker } from './DashboardDatePicker';
import { WorkdayBoard } from './WorkdayBoard';
import { TaskComposer } from './TaskComposer';
import type { MoscowWeather } from '@/modules/weather/server/get-moscow-weather';

const periods = [
  ['today', 'Сегодня'],
  ['tomorrow', 'Завтра'],
  ['day-after-tomorrow', 'Послезавтра'],
  ['week', 'Неделя'],
  ['month', 'Месяц'],
] as const;

const quickActions = [
  ['/clients?form=new', 'Новый клиент'],
  ['/rentals/new', 'Новая аренда'],
  ['/maintenance', 'Поставить на ТО'],
  ['/wash', 'Отправить на мойку'],
] as const;

export function CommandCenterDashboard({
  overview,
  weather = null,
}: {
  overview: DashboardOverviewDto;
  weather?: MoscowWeather | null;
}) {
  return (
    <div className="graphite-dashboard grid gap-4 pb-8">
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

      <CommandCenterKpis kpis={overview.kpis} weather={weather} />

      <nav
        aria-label="Период командного центра"
        className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-1"
      >
        <DashboardDatePicker
          selectionLabel={overview.period.label}
          isCustom={overview.period.key === 'custom'}
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

      <div className="grid gap-4">
        <div>
          <WorkdayBoard
            items={overview.workItems}
            now={overview.generatedAt ?? overview.period.from}
          />
        </div>
        <div className="max-w-xl">
          <div className="grid gap-4">
            <TaskComposer />
          </div>
        </div>
      </div>
    </div>
  );
}
