import { FleetEvents, FleetStatCard, FleetStatusPanel } from './DashboardPanels';
import { FleetMapClient } from './FleetMapClient';
import { MobileFleetWorkspace } from './MobileFleetWorkspace';
import type { FleetEvent, FleetStat, Vehicle } from './types';
import { Button } from '@/shared/ui';

interface DashboardProps {
  stats: readonly FleetStat[];
  events: readonly FleetEvent[];
  vehicles: readonly Vehicle[];
}

export function Dashboard({ stats, events, vehicles }: DashboardProps) {
  return (
    <>
      <MobileFleetWorkspace vehicles={vehicles} />
      <div className="hidden gap-6 md:grid">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[30px] leading-10 font-bold tracking-tight">Панель управления</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Мониторинг демонстрационного автопарка
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Действия панели управления">
            <Button variant="secondary">Фильтр</Button>
            <Button variant="secondary">Сегодня</Button>
            <Button>Добавить вид</Button>
          </div>
        </header>

        <section
          aria-label="Показатели автопарка"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
        >
          {stats.map((stat) => (
            <FleetStatCard key={stat.id} stat={stat} />
          ))}
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
          <div
            data-testid="fleet-map-workspace"
            className="h-[32rem] min-h-[560px] min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] shadow-[var(--shadow-card)] xl:h-[42rem]"
          >
            <FleetMapClient vehicles={vehicles} mode="desktop" />
          </div>
          <FleetStatusPanel vehicles={vehicles} />
        </section>

        <FleetEvents events={events} />
      </div>
    </>
  );
}
