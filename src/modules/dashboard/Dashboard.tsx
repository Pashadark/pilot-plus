import { FleetEvents, FleetStatCard } from './DashboardPanels';
import { FuelChart, MileageChart } from './DashboardCharts';
import { FleetMapClient } from './FleetMapClient';
import { MobileFleetWorkspace } from './MobileFleetWorkspace';
import type { FleetEvent, FleetStat, FuelSlice, MileagePoint, Vehicle } from './types';
import { Card, CardHeader } from '@/shared/ui';
import { FiCalendar, FiFilter, FiSliders } from 'react-icons/fi';

interface DashboardProps {
  stats: readonly FleetStat[];
  events: readonly FleetEvent[];
  vehicles: readonly Vehicle[];
  mileage: readonly MileagePoint[];
  fuel: readonly FuelSlice[];
}

function DashboardAction({ icon: Icon, children }: { icon: typeof FiCalendar; children: string }) {
  return (
    <button className="flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-3 text-xs font-medium shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
      <Icon aria-hidden="true" className="size-4" />
      {children}
    </button>
  );
}

export function Dashboard({ stats, events, vehicles, mileage, fuel }: DashboardProps) {
  return (
    <>
      <MobileFleetWorkspace vehicles={vehicles} />
      <div data-testid="dashboard-desktop" className="hidden gap-4 md:grid">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl leading-8 font-bold tracking-tight">Панель управления</h1>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Состояние автопарка в реальном времени
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Действия панели управления">
            <DashboardAction icon={FiCalendar}>Сегодня, 19 июл</DashboardAction>
            <DashboardAction icon={FiFilter}>Фильтры</DashboardAction>
            <DashboardAction icon={FiSliders}>Настроить вид</DashboardAction>
          </div>
        </header>

        <section
          aria-label="Показатели автопарка"
          className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"
        >
          {stats.map((stat) => (
            <FleetStatCard key={stat.id} stat={stat} />
          ))}
        </section>

        <section className="grid min-h-[580px] items-stretch gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(15rem,1fr)] xl:grid-cols-[minmax(0,1.8fr)_minmax(14rem,.66fr)_minmax(18rem,1fr)]">
          <Card
            data-testid="fleet-map-workspace"
            className="flex min-h-[580px] min-w-0 flex-col overflow-hidden"
          >
            <CardHeader className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">Карта транспорта</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">Москва</span>
            </CardHeader>
            <div className="relative min-h-0 flex-1">
              <FleetMapClient vehicles={vehicles} mode="desktop" />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-[11px] text-[var(--color-text-secondary)]">
              <span>
                <i className="mr-2 inline-block size-2 rounded-full bg-[var(--color-success)]" />
                На ходу (87)
              </span>
              <span>
                <i className="mr-2 inline-block size-2 rounded-full bg-[var(--color-warning)]" />
                Остановки (21)
              </span>
              <span>
                <i className="mr-2 inline-block size-2 rounded-full bg-[var(--color-danger)]" />
                Нет на связи (8)
              </span>
            </div>
          </Card>

          <FleetEvents events={events} />

          <div
            data-testid="dashboard-analytics"
            className="grid min-h-0 gap-4 lg:col-span-2 xl:col-span-1 xl:grid-rows-2"
          >
            <MileageChart points={mileage} />
            <FuelChart slices={fuel} />
          </div>
        </section>
      </div>
    </>
  );
}
