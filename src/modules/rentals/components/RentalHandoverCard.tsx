import type { RentalDetailView } from './rental-detail-presentation';

import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

function DetailList({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid gap-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid min-w-0 gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3"
        >
          <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
          <dd className="text-sm font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RentalHandoverCard({ detail }: { detail: RentalDetailView }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="text-lg font-bold">Выдача и возврат</h2>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6">
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="grid gap-3" aria-labelledby="rental-pickup">
            <h3 id="rental-pickup" className="font-bold">
              Выдача
            </h3>
            <DetailList
              rows={[
                ['Плановая дата', detail.term.startsAt],
                ['Адрес', detail.operations.pickupAddress],
                ['Пробег', detail.operations.startMileage],
                ['Топливо', detail.operations.startFuel],
              ]}
            />
          </section>
          <section className="grid gap-3" aria-labelledby="rental-return">
            <h3 id="rental-return" className="font-bold">
              Возврат
            </h3>
            <DetailList
              rows={[
                ['Плановая дата', detail.term.endsAt],
                ['Адрес', detail.operations.returnAddress],
                ['Пробег', detail.operations.returnMileage],
                ['Топливо', detail.operations.returnFuel],
              ]}
            />
          </section>
        </div>
        <div className="border-t pt-5">
          <DetailList
            rows={[
              ['Включённый пробег', detail.operations.includedMileage],
              ['Перепробег', `${detail.operations.overagePrice} за км`],
              ['Недостающее топливо', `${detail.operations.missingFuelPrice} за литр`],
              ['Территория', detail.operations.territory],
              ['Условия оплаты', detail.operations.paymentTerms],
              [
                'Допущенные водители',
                detail.operations.allowedDrivers.length
                  ? detail.operations.allowedDrivers.join(', ')
                  : 'Не указано',
              ],
              ['Дополнительные условия', detail.operations.conditions],
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
