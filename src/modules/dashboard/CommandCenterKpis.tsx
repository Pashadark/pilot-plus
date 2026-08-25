import { FiAlertTriangle, FiCheckCircle, FiClock, FiDollarSign, FiTool } from 'react-icons/fi';
import Link from 'next/link';
import { Card } from '@/shared/ui';
import type { DashboardKpiDto } from './overview-types';

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function formatMinor(value: string) {
  return money.format(Number(BigInt(value)) / 100);
}

export function CommandCenterKpis({ kpis }: { kpis: DashboardKpiDto }) {
  const items = [
    { label: 'Заработано за всё время', value: formatMinor(kpis.lifetimeEarnedMinor), hint: 'Без депозитов', icon: FiDollarSign, tone: 'text-[var(--color-success)]', href: '/rentals?finance=income' },
    { label: 'Депозиты по договорам', value: formatMinor(kpis.lifetimeDepositsMinor), hint: 'За всё время', icon: FiClock, tone: 'text-[var(--color-warning)]', href: '/rentals?finance=deposits' },
    { label: 'Сейчас на руках', value: formatMinor(kpis.heldDepositsMinor), hint: 'Нужно контролировать', icon: FiClock, tone: 'text-[var(--color-warning)]', href: '/rentals?deposit=held' },
    { label: 'Свободно', value: String(kpis.freeVehicles), hint: 'Можно выдавать', icon: FiCheckCircle, tone: 'text-[var(--color-success)]' },
    { label: 'В аренде', value: String(kpis.occupiedVehicles), hint: 'Заняты сейчас', icon: FiClock, tone: 'text-[var(--color-primary)]' },
    { label: 'ТО и мойка', value: String(kpis.serviceVehicles), hint: 'Недоступны', icon: FiTool, tone: 'text-[var(--color-warning)]' },
    { label: 'Нет GPS-связи', value: String(kpis.offlineVehicles), hint: 'Нужно проверить', icon: FiAlertTriangle, tone: 'text-[var(--color-danger)]', href: '/vehicles?gps=offline' },
  ];

  return (
    <section aria-label="Показатели автопарка" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {items.map(({ label, value, hint, icon: Icon, tone, href }) => {
        const card = <Card className="min-w-0 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
            <Icon aria-hidden="true" className={`size-4 shrink-0 ${tone}`} />
          </div>
          <p className="mt-3 truncate text-2xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{hint}</p>
        </Card>;
        return href ? <Link key={label} href={href} className="rounded-[var(--radius-panel)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">{card}</Link> : <div key={label}>{card}</div>;
      })}
    </section>
  );
}
