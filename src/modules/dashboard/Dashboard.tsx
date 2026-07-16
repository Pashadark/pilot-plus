import { FleetEvents, FleetStatCard, FleetStatusPanel } from './DashboardPanels';
import { FleetMapClient } from './FleetMapClient';
import { MobileFleetWorkspace } from './MobileFleetWorkspace';
import type { FleetEvent, FleetStat, Vehicle } from './types';

interface DashboardProps {
  stats: readonly FleetStat[];
  events: readonly FleetEvent[];
  vehicles: readonly Vehicle[];
}

export function Dashboard({ stats, events, vehicles }: DashboardProps) {
  return (
    <>
      <MobileFleetWorkspace vehicles={vehicles} />
      <div className="hidden gap-6 md:grid lg:gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Центр управления транспортом
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Мониторинг демонстрационного автопарка в реальном времени
          </p>
        </header>

        <section
          aria-label="Показатели автопарка"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {stats.map((stat) => (
            <FleetStatCard key={stat.id} stat={stat} />
          ))}
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
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
