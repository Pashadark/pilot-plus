import Link from 'next/link';
import { FiArrowRight, FiMapPin, FiPhone } from 'react-icons/fi';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';
import type { DashboardWorkItemDto } from './overview-types';

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });

export function WorkdayBoard({ items }: { items: DashboardWorkItemDto[] }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Рабочий день</h2><p className="text-xs text-[var(--color-text-secondary)]">Сначала просроченное, затем по времени</p></div>
        <Badge tone={items.some((item) => item.overdue) ? 'danger' : 'success'}>{items.length} действий</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-5 py-12 text-center"><p className="font-medium">На выбранный день обязательных действий нет</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Можно планировать новые задачи и выдачи.</p></div>
        ) : (
          <ol className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[4.25rem_minmax(0,1fr)_auto] sm:items-center">
                <time className="text-sm font-bold" dateTime={item.scheduledAt}>{time.format(new Date(item.scheduledAt))}</time>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge tone={item.tone}>{item.overdue ? 'Просрочено' : item.contractNumber ?? 'Запланировано'}</Badge></div>
                  <p className="mt-1 truncate text-sm">{item.vehicleLabel}{item.clientLabel ? ` · ${item.clientLabel}` : ''}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                    {item.address ? <span className="inline-flex items-center gap-1"><FiMapPin />{item.address}</span> : null}
                    {item.phone ? <a className="inline-flex items-center gap-1 hover:text-[var(--color-primary)]" href={`tel:${item.phone}`}><FiPhone />{item.phone}</a> : null}
                    {item.amountMinor ? <span>{money.format(Number(BigInt(item.amountMinor)) / 100)}</span> : null}
                  </div>
                </div>
                <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 text-sm font-semibold hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]" href={item.href}>Открыть договор<FiArrowRight aria-hidden="true" /></Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
