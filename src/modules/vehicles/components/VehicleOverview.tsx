import Link from 'next/link';
import { FiActivity, FiCalendar, FiCheckCircle, FiClock, FiDroplet, FiUser } from 'react-icons/fi';

import type { VehicleDetailDto } from '../types';
import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';

function formatDate(value: string | null) {
  if (!value) return 'Не запланировано';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: PILOT_BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

export function VehicleOverview({ vehicle }: { vehicle: VehicleDetailDto }) {
  const activeRental =
    vehicle.currentRentalId === undefined
      ? vehicle.rentals?.find((rental) => rental.status === 'ACTIVE')
      : vehicle.rentals?.find((rental) => rental.id === vehicle.currentRentalId);
  const nextRental = vehicle.rentals
    ?.filter((rental) => ['DRAFT', 'CONFIRMED'].includes(rental.status))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
  const isInPark =
    vehicle.telemetry.address?.toLocaleLowerCase('ru-RU').includes('зел') &&
    vehicle.telemetry.address.includes('22');

  return (
    <section className="grid gap-4 lg:grid-cols-2" data-testid="vehicle-overview">
      <article className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-base font-bold">Готовность к работе</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          <OverviewRow
            icon={<FiCheckCircle />}
            label="Операционный статус"
            value={isInPark ? 'Автомобиль в парке и готов к выдаче' : vehicle.gpsStatus.label}
            success={isInPark}
          />
          <OverviewRow
            icon={<FiDroplet />}
            label="Топливо"
            value={
              vehicle.telemetry.fuelLevelPercent === null
                ? 'Нет данных'
                : `${vehicle.telemetry.fuelLevelPercent}%`
            }
          />
          <OverviewRow
            icon={<FiActivity />}
            label="Чистота"
            value={vehicle.washRecords[0]?.status === 'COMPLETED' ? 'Чистая' : 'Требуется проверка'}
          />
          <OverviewRow
            icon={<FiClock />}
            label="Последний сигнал"
            value={formatDate(vehicle.telemetry.lastSeenAt)}
          />
        </div>
      </article>

      <article className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-base font-bold">Текущая аренда / ближайшее бронирование</h2>
        {activeRental ? (
          <div className="mt-4 rounded-lg bg-[var(--color-primary-soft)] p-4">
            <p className="text-xs font-semibold text-[var(--color-primary)]">Сейчас в аренде</p>
            <Link
              href={`/rentals/${activeRental.id}`}
              className="mt-1 block font-semibold hover:underline"
            >
              {activeRental.contractNumber ?? 'Договор без номера'}
            </Link>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {activeRental.client.fullName}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-[var(--color-primary-soft)] p-4 text-sm">
            Активной аренды нет. Автомобиль доступен для выдачи.
          </div>
        )}
        <div className="mt-3 divide-y divide-[var(--color-border)]">
          <OverviewRow
            icon={<FiCalendar />}
            label="Ближайшее бронирование"
            value={
              nextRental
                ? `${formatDate(nextRental.startsAt)} · ${nextRental.client.fullName}`
                : 'Не запланировано'
            }
          />
          <OverviewRow
            icon={<FiUser />}
            label="Плановый возврат"
            value={activeRental ? formatDate(activeRental.endsAt) : '—'}
          />
          <OverviewRow
            icon={<FiClock />}
            label="Доступен с"
            value={activeRental ? formatDate(activeRental.endsAt) : 'Сейчас'}
          />
        </div>
      </article>
    </section>
  );
}

function OverviewRow({
  icon,
  label,
  value,
  success = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={`mt-0.5 size-5 shrink-0 ${success ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{value}</p>
      </div>
    </div>
  );
}
