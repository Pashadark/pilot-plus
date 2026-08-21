import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

export type RentalOperationTimelineItem = {
  id: string;
  type: 'HANDOVER' | 'EXTENSION' | 'RETURN';
  occurredAt: string;
  actorName: string;
  evidenceStatus: string;
  evidenceMissingReason: string | null;
  mileageKm: number | null;
  fuelLevelPercent: number | null;
  fulfillmentMethod: string | null;
  fulfillmentAddress: string | null;
  nextEndsAt: string | null;
  totalChargeMinor: string | null;
};

const operationLabels = {
  HANDOVER: 'Выдача автомобиля',
  EXTENSION: 'Продление аренды',
  RETURN: 'Возврат автомобиля',
};
const evidenceLabels: Record<string, string> = {
  VIDEO_MISSING: 'Нет видео осмотра',
  DASHBOARD_PHOTO_MISSING: 'Нет фото приборной панели',
  MISSING: 'Фиксация пропущена',
};

function date(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function RentalOperationTimeline({
  operations,
}: {
  operations: readonly RentalOperationTimelineItem[];
}) {
  return (
    <Card role="region" aria-labelledby="rental-operation-history">
      <CardHeader>
        <h2 id="rental-operation-history" className="text-lg font-bold">
          Выдача, продления и возврат
        </h2>
      </CardHeader>
      <CardContent>
        {operations.length ? (
          <ol className="grid gap-3">
            {operations.map((operation) => (
              <li key={operation.id} className="grid gap-2 rounded-[var(--radius-md)] border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{operationLabels[operation.type]}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {date(operation.occurredAt)} · {operation.actorName}
                    </p>
                  </div>
                  {operation.evidenceStatus === 'COMPLETE' ? (
                    <span className="rounded-full bg-[var(--color-success-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
                      Фиксация полная
                    </span>
                  ) : (
                    <span
                      role="alert"
                      className="rounded-full bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-warning)]"
                    >
                      {evidenceLabels[operation.evidenceStatus] ?? 'Фиксация неполная'}
                    </span>
                  )}
                </div>
                {operation.mileageKm !== null && operation.fuelLevelPercent !== null ? (
                  <p>
                    {new Intl.NumberFormat('ru-RU').format(operation.mileageKm)} км · топливо{' '}
                    {operation.fuelLevelPercent}%
                  </p>
                ) : null}
                {operation.fulfillmentMethod ? (
                  <p className="text-sm">
                    {operation.fulfillmentMethod === 'DELIVERY'
                      ? `Подача: ${operation.fulfillmentAddress ?? 'адрес не указан'}`
                      : 'Выдача в офисе'}
                  </p>
                ) : null}
                {operation.nextEndsAt ? (
                  <p className="text-sm">Новый возврат: {date(operation.nextEndsAt)}</p>
                ) : null}
                {operation.evidenceMissingReason ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {operation.evidenceMissingReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Выдача, продления и возврат пока не зафиксированы.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
