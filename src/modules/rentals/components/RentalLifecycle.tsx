import { FiCheckCircle } from 'react-icons/fi';

import type { RentalDetailView } from './rental-detail-presentation';

import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

export function RentalLifecycle({ detail }: { detail: RentalDetailView }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="text-lg font-bold">Этапы аренды</h2>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-4">
          {detail.lifecycle.map((event) => (
            <li key={event.key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
                <FiCheckCircle aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{event.label}</p>
                <time
                  className="text-sm text-[var(--color-text-secondary)]"
                  dateTime={event.occurredAt}
                >
                  {new Intl.DateTimeFormat('ru-RU', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Europe/Moscow',
                  }).format(new Date(event.occurredAt))}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
