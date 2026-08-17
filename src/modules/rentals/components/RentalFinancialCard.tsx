import type { RentalDetailView } from './rental-detail-presentation';

import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

export function RentalFinancialCard({ detail }: { detail: RentalDetailView }) {
  const rows = [
    ['Тариф за сутки', detail.finance.dailyRate],
    ['Оплачиваемые дни', detail.term.billableDaysLabel],
    ['Базовая стоимость', detail.finance.basePrice],
    ['Скидка', detail.finance.discount],
    ['Дополнительные услуги', detail.finance.services],
    ['Залог', detail.finance.deposit],
  ];

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="text-lg font-bold">Стоимость аренды</h2>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="grid gap-1">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex min-w-0 items-center justify-between gap-4 border-b py-2 last:border-b-0"
            >
              <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
              <dd className="text-right text-sm font-semibold break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-end justify-between gap-4 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-4">
          <span className="font-semibold text-[var(--color-primary)]">Итого</span>
          <strong className="text-2xl text-[var(--color-primary)]">{detail.finance.total}</strong>
        </div>
        {detail.finance.priceOverrideReason !== 'Не указано' ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Причина изменения цены: {detail.finance.priceOverrideReason}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
