import Link from 'next/link';
import { FiArrowLeft, FiMapPin, FiTruck } from 'react-icons/fi';

import type { VehicleDetailDto, VehicleStatus } from '../types';
import { formatDailyPrice, formatOptionalMetric } from '../utils';
import { VehicleEmptySection } from './VehicleEmptySection';
import { VehicleOverview } from './VehicleOverview';
import { VehiclePhoto } from './VehiclePhoto';
import { VehicleTabs } from './VehicleTabs';
import type { VehicleTab } from './vehicle-tabs';
import { Badge, Card, CardContent } from '@/shared/ui';

const statuses: Record<VehicleStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  MOVING: { label: 'В движении', tone: 'success' },
  IDLE: { label: 'Стоит', tone: 'warning' },
  OFFLINE: { label: 'Не на связи', tone: 'danger' },
  MAINTENANCE: { label: 'Обслуживание', tone: 'info' },
  UNKNOWN: { label: 'Нет телеметрии', tone: 'neutral' },
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Нет данных';
}

function TabContent({ vehicle, tab }: { vehicle: VehicleDetailDto; tab: VehicleTab }) {
  if (tab === 'overview') return <VehicleOverview vehicle={vehicle} />;
  if (tab === 'trips' && vehicle.trips.length) return <Card><CardContent className="grid gap-3">{vehicle.trips.map((trip) => <article key={trip.id} className="grid gap-1 border-b border-[var(--color-border)] pb-3 last:border-0"><strong>{formatDate(trip.startedAt)}</strong><span className="text-sm text-[var(--color-text-secondary)]">Окончание: {formatDate(trip.endedAt)} · Расстояние: {formatOptionalMetric(trip.distanceKm, 'км')}</span></article>)}</CardContent></Card>;
  if (tab === 'events' && vehicle.events.length) return <Card><CardContent className="grid gap-3">{vehicle.events.map((event) => <article key={event.id} className="border-b border-[var(--color-border)] pb-3 last:border-0"><strong>{event.title}</strong><p className="text-sm text-[var(--color-text-secondary)]">{formatDate(event.recordedAt)}{event.description ? ` · ${event.description}` : ''}</p></article>)}</CardContent></Card>;
  if (tab === 'fuel' && vehicle.fuelRecords.length) return <Card><CardContent className="grid gap-3">{vehicle.fuelRecords.map((record) => <p key={record.id} className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-3 last:border-0"><span>{formatDate(record.recordedAt)}</span><strong>{formatOptionalMetric(record.volumeLiters, 'л')}</strong></p>)}</CardContent></Card>;
  if (tab === 'maintenance' && vehicle.maintenanceRecords.length) return <Card><CardContent className="grid gap-3">{vehicle.maintenanceRecords.map((record) => <article key={record.id} className="border-b border-[var(--color-border)] pb-3 last:border-0"><strong>{record.title}</strong><p className="text-sm text-[var(--color-text-secondary)]">Статус: {record.status} · План: {formatDate(record.scheduledAt)}</p></article>)}</CardContent></Card>;
  if (tab === 'documents' && vehicle.documents.length) return <Card><CardContent className="grid gap-3">{vehicle.documents.map((document) => <article key={document.id} className="border-b border-[var(--color-border)] pb-3 last:border-0"><strong>{document.title}</strong><p className="text-sm text-[var(--color-text-secondary)]">Тип: {document.type} · Действует до: {formatDate(document.expiresAt)}</p></article>)}</CardContent></Card>;
  return <VehicleEmptySection tab={tab} />;
}

export function VehicleDetailPage({ vehicle, activeTab }: { vehicle: VehicleDetailDto; activeTab: VehicleTab }) {
  const status = statuses[vehicle.status];
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="vehicle-detail-page">
      <Link href="/vehicles" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><FiArrowLeft aria-hidden="true" />К автопарку</Link>
      <Card className="overflow-hidden">
        <header className="grid items-stretch md:grid-cols-[minmax(260px,38%)_1fr]">
          <VehiclePhoto
            image={vehicle.primaryImage}
            model={vehicle.model}
            city={vehicle.city}
            sizes="(max-width: 768px) 100vw, 38vw"
            testId="vehicle-detail-photo"
            className="md:aspect-auto md:min-h-56"
          />
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="flex min-w-0 gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><FiTruck aria-hidden="true" className="size-6" /></span>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{vehicle.model}</h1><Badge tone={status.tone}>{status.label}</Badge></div><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{vehicle.internalNumber}{vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}</p><p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]"><FiMapPin aria-hidden="true" />{[vehicle.city, vehicle.office].filter(Boolean).join(' · ')}</p></div>
            </div>
            <div className="text-right"><span className="block text-xs text-[var(--color-text-tertiary)]">Стоимость аренды</span><strong className="text-lg">{formatDailyPrice(vehicle.dailyPriceMinor, vehicle.currency)}</strong></div>
          </div>
        </header>
        <VehicleTabs vehicleId={vehicle.id} activeTab={activeTab} />
      </Card>
      <TabContent vehicle={vehicle} tab={activeTab} />
    </main>
  );
}
