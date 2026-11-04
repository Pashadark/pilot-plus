import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDroplet,
  FiFileText,
  FiSettings,
  FiTool,
  FiUsers,
} from 'react-icons/fi';
import Link from 'next/link';
import { Card } from '@/shared/ui';
import type { DashboardKpiDto } from './overview-types';
import { MoscowWeatherCard } from '@/modules/weather/MoscowWeatherCard';
import type { MoscowWeather } from '@/modules/weather/server/get-moscow-weather';

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function formatMinor(value: string) {
  return money.format(Number(BigInt(value)) / 100);
}

function RubleCoinIcon({ className }: { className?: string }) {
  return (
    <span
      aria-label="Рубли"
      className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] leading-none font-black ${className ?? ''}`}
    >
      ₽
    </span>
  );
}

export function CommandCenterKpis({
  kpis,
  weather,
}: {
  kpis: DashboardKpiDto;
  weather: MoscowWeather | null;
}) {
  const items = [
    {
      label: 'Заработано за всё время',
      value: formatMinor(kpis.lifetimeEarnedMinor),
      hint: 'Без депозитов',
      icon: RubleCoinIcon,
      tone: 'text-[var(--color-success)]',
      href: '/rentals?finance=income',
    },
    {
      label: 'Залоги к возврату',
      value: formatMinor(kpis.heldDepositsMinor),
      hint: 'Без возвратов и удержаний',
      icon: FiClock,
      tone: 'text-[var(--color-warning)]',
      href: '/deposits',
    },
    {
      label: 'Свободно',
      value: String(kpis.freeVehicles),
      hint: 'Можно выдавать',
      icon: FiCheckCircle,
      tone: 'text-[var(--color-success)]',
    },
    {
      label: 'В аренде',
      value: String(kpis.occupiedVehicles),
      hint: 'Заняты сейчас',
      icon: FiClock,
      tone: 'text-[var(--color-primary)]',
    },
    {
      label: 'ТО',
      value: String(kpis.maintenanceVehicles),
      hint: 'На обслуживании',
      icon: FiTool,
      tone: 'text-[var(--color-warning)]',
      href: '/maintenance?view=list',
    },
    {
      label: 'Ремонт',
      value: String(kpis.repairVehicles),
      hint: 'Сейчас в работе',
      icon: FiSettings,
      tone: 'text-[var(--color-danger)]',
      href: '/maintenance?view=list',
    },
    {
      label: 'Мойка',
      value: String(kpis.washVehicles),
      hint: 'На мойке сейчас',
      icon: FiDroplet,
      tone: 'text-[var(--color-primary)]',
      href: '/wash',
    },
    {
      label: 'Нет GPS-связи',
      value: String(kpis.offlineVehicles),
      hint: 'Нужно проверить',
      icon: FiAlertTriangle,
      tone: 'text-[var(--color-danger)]',
      href: '/vehicles?gps=offline',
    },
    {
      label: 'Договоры',
      value: String(kpis.contracts),
      hint: 'Всего в системе',
      icon: FiFileText,
      tone: 'text-[var(--color-primary)]',
      href: '/rentals',
    },
    {
      label: 'Клиенты',
      value: String(kpis.clients),
      hint: 'Всего в базе',
      icon: FiUsers,
      tone: 'text-[var(--color-primary)]',
      href: '/clients',
    },
  ];

  return (
    <section
      aria-label="Показатели автопарка"
      className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"
    >
      <MoscowWeatherCard weather={weather} />
      {items.map(({ label, value, hint, icon: Icon, tone, href }) => {
        const card = (
          <Card className="min-w-0 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
              <Icon aria-hidden="true" className={`size-4 shrink-0 ${tone}`} />
            </div>
            <p className="mt-3 truncate text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{hint}</p>
          </Card>
        );
        return href ? (
          <Link
            key={label}
            href={href}
            className="rounded-[var(--radius-panel)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            {card}
          </Link>
        ) : (
          <div key={label}>{card}</div>
        );
      })}
    </section>
  );
}
