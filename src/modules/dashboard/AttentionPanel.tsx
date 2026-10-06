import Link from 'next/link';
import { FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';
import type { DashboardAttentionItemDto } from './overview-types';

function vehicleWord(count: number) {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'автомобилей';
  const last = count % 10;
  if (last === 1) return 'автомобиль';
  if (last >= 2 && last <= 4) return 'автомобиля';
  return 'автомобилей';
}

export function AttentionPanel({ items }: { items: DashboardAttentionItemDto[] }) {
  const gpsItems = items.filter((item) => item.id.startsWith('offline:'));
  const visibleItems = items.filter((item) => !item.id.startsWith('offline:'));

  if (gpsItems.length > 0) {
    visibleItems.push({
      id: 'offline:group',
      tone: gpsItems.some((item) => item.tone === 'danger') ? 'danger' : 'warning',
      title: 'Нет актуального GPS-сигнала',
      description: `${gpsItems.length} ${vehicleWord(gpsItems.length)}`,
      href: '/vehicles?gps=offline',
    });
  }

  return (
    <section aria-labelledby="attention-heading">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 id="attention-heading" className="text-lg font-semibold">
              Требует внимания
            </h2>
            <Badge tone={visibleItems.length ? 'danger' : 'success'}>{visibleItems.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              Критичных ситуаций нет
            </p>
          ) : (
            visibleItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`group block rounded-[var(--radius-md)] border p-3 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${item.tone === 'danger' ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]' : 'border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]'}`}
              >
                <div className="flex gap-2">
                  <FiAlertCircle
                    aria-hidden="true"
                    className={`mt-0.5 size-4 shrink-0 ${item.tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {item.description}
                    </p>
                  </div>
                  <FiArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
