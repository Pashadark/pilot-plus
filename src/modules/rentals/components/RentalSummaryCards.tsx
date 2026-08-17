import { FiCalendar, FiCreditCard, FiDollarSign, FiTruck } from 'react-icons/fi';

import type { RentalDetailView } from './rental-detail-presentation';

import { Card, CardContent } from '@/shared/ui/Card';

const items = (detail: RentalDetailView) => [
  {
    label: 'Срок аренды',
    value: detail.term.billableDaysLabel,
    caption: `${detail.term.startsAt} — ${detail.term.endsAt}`,
    icon: FiCalendar,
  },
  {
    label: 'Итоговая стоимость',
    value: detail.finance.total,
    caption: `${detail.finance.dailyRate} в сутки`,
    icon: FiDollarSign,
  },
  {
    label: 'Залог',
    value: detail.finance.deposit,
    caption: 'Сумма обеспечения по договору',
    icon: FiCreditCard,
  },
  {
    label: 'Автомобиль',
    value: detail.vehicle.label,
    caption: detail.client.label,
    icon: FiTruck,
  },
];

export function RentalSummaryCards({ detail }: { detail: RentalDetailView }) {
  return (
    <section
      aria-label="Краткая информация"
      className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items(detail).map(({ label, value, caption, icon: Icon }) => (
        <Card key={label} className="min-w-0">
          <CardContent className="grid h-full min-w-0 gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon aria-hidden="true" />
              </span>
            </div>
            <p className="text-xl font-bold break-words">{value}</p>
            <p className="text-xs leading-5 break-words text-[var(--color-text-secondary)]">
              {caption}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
