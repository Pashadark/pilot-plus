import Link from 'next/link';
import { FiCrosshair, FiMap, FiRadio, FiTruck } from 'react-icons/fi';

import type {
  GlonassTrackerItem,
  GlonassTrackerStatus,
} from '../server/glonass-queries';

type Data = {
  trackers: readonly GlonassTrackerItem[];
  summary: { total: number; online: number; stale: number; offline: number };
};

const statusMeta: Record<GlonassTrackerStatus, { label: string; className: string }> = {
  ONLINE: { label: 'На связи', className: 'bg-emerald-50 text-emerald-700' },
  STALE: { label: 'Сигнал устарел', className: 'bg-amber-50 text-amber-700' },
  OFFLINE: { label: 'Нет связи', className: 'bg-rose-50 text-rose-700' },
  NO_DATA: { label: 'Нет данных', className: 'bg-slate-100 text-slate-600' },
};

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function Status({ status }: { status: GlonassTrackerStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function speedLabel(tracker: GlonassTrackerItem) {
  if (tracker.status === 'STALE' || tracker.status === 'OFFLINE' || tracker.status === 'NO_DATA') {
    return 'Нет актуальных данных';
  }
  if (tracker.speedKph === 0) return 'Стоит';
  return tracker.speedKph == null ? 'Нет данных' : `${tracker.speedKph} км/ч`;
}

export function GlonassDevicesPage({ data }: { data: Data }) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="glonass-devices-page">
      <header>
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
          <FiRadio aria-hidden="true" /> ГЛОНАССSoft
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
          Трекеры ГЛОНАССSoft
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Только реальные объекты, связанные с автомобилями вашего автопарка.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Сводка трекеров">
        <Metric label="Всего трекеров" value={data.summary.total} />
        <Metric label="На связи" value={data.summary.online} tone="success" />
        <Metric label="Сигнал устарел" value={data.summary.stale} tone="warning" />
        <Metric label="Нет связи" value={data.summary.offline} tone="danger" />
      </section>

      {data.trackers.length === 0 ? (
        <section className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <FiCrosshair className="mx-auto size-8 text-[var(--color-text-secondary)]" />
          <h2 className="mt-3 font-bold">Нет связанных объектов ГЛОНАССSoft</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            После синхронизации здесь появятся только реальные трекеры автомобилей.
          </p>
        </section>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-[var(--color-elevated)] text-xs text-[var(--color-text-secondary)]">
                <tr>
                  <th className="w-[19%] px-4 py-3">Трекер</th>
                  <th className="w-[24%] px-4 py-3">Автомобиль</th>
                  <th className="w-[13%] px-4 py-3 text-center">Скорость</th>
                  <th className="w-[22%] px-4 py-3">Последний сигнал</th>
                  <th className="w-[12%] px-4 py-3">Статус</th>
                  <th className="w-[10%] px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.trackers.map((tracker) => (
                  <tr key={tracker.id} className="hover:bg-[var(--color-elevated)]/55">
                    <td className="px-4 py-3">
                      <p className="font-semibold">Объект {tracker.externalId}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">ГЛОНАССSoft</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/vehicles/${tracker.vehicle.id}`} className="font-semibold hover:text-[var(--color-primary)]">
                        {tracker.vehicle.name}
                      </Link>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {tracker.vehicle.internalNumber} · {tracker.vehicle.registrationNumber ?? 'Без номера'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums">
                      {speedLabel(tracker)}
                    </td>
                    <td className="px-4 py-3">
                      <p>{tracker.lastSeenAt ? dateTime.format(new Date(tracker.lastSeenAt)) : 'Нет данных'}</p>
                      <p className="truncate text-xs text-[var(--color-text-secondary)]">{tracker.address ?? 'Адрес не определён'}</p>
                    </td>
                    <td className="px-4 py-3"><Status status={tracker.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/map?vehicleId=${tracker.vehicle.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-3 font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]">
                        <FiMap aria-hidden="true" /> Карта
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {data.trackers.map((tracker) => (
              <article key={tracker.id} className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--color-primary)]">Объект {tracker.externalId}</p>
                    <Link href={`/vehicles/${tracker.vehicle.id}`} className="mt-1 block truncate font-bold">
                      {tracker.vehicle.name}
                    </Link>
                    <p className="text-sm text-[var(--color-text-secondary)]">{tracker.vehicle.registrationNumber ?? 'Без номера'}</p>
                  </div>
                  <Status status={tracker.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-[var(--color-text-secondary)]">Скорость</dt><dd className="font-semibold">{speedLabel(tracker)}</dd></div>
                  <div><dt className="text-xs text-[var(--color-text-secondary)]">Последний сигнал</dt><dd className="font-semibold">{tracker.lastSeenAt ? dateTime.format(new Date(tracker.lastSeenAt)) : 'Нет данных'}</dd></div>
                </dl>
                <Link href={`/map?vehicleId=${tracker.vehicle.id}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 font-semibold text-white">
                  <FiTruck aria-hidden="true" /> Открыть на карте
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'danger' }) {
  const color = tone ? `var(--color-${tone})` : 'var(--color-primary)';
  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <strong className="mt-1 block text-2xl tabular-nums" style={{ color }}>{value}</strong>
    </div>
  );
}
