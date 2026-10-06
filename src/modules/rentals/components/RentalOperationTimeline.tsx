import Link from 'next/link';

import { Card, CardContent, CardHeader } from '@/shared/ui/Card';

export type RentalOperationTimelineItem = {
  id: string;
  type: 'HANDOVER' | 'EXTENSION' | 'RETURN' | 'DEPOSIT_RETURN' | 'WEEKLY_INSPECTION';
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
  depositAmountMinor?: string | null;
  depositWithheldMinor?: string | null;
  depositStatus?: string | null;
  depositResolutionReason?: string | null;
  media: Array<{
    kind:
      | 'INSPECTION_VIDEO'
      | 'DASHBOARD_PHOTO'
      | 'BODY_PHOTO_FRONT'
      | 'BODY_PHOTO_REAR'
      | 'BODY_PHOTO_LEFT'
      | 'BODY_PHOTO_RIGHT';
    verifiedMime: string | null;
  }>;
};

const operationLabels = {
  HANDOVER: 'Выдача автомобиля',
  EXTENSION: 'Продление аренды',
  RETURN: 'Возврат автомобиля',
  DEPOSIT_RETURN: 'Возврат залога',
  WEEKLY_INSPECTION: 'Еженедельный осмотр',
};
const evidenceLabels: Record<string, string> = {
  VIDEO_MISSING: 'Нет видео осмотра',
  DASHBOARD_PHOTO_MISSING: 'Нет фото приборной панели',
  MISSING: 'Фиксация пропущена',
};
const mediaLabels: Record<RentalOperationTimelineItem['media'][number]['kind'], string> = {
  INSPECTION_VIDEO: 'Открыть видео',
  DASHBOARD_PHOTO: 'Открыть фото приборки',
  BODY_PHOTO_FRONT: 'Кузов спереди',
  BODY_PHOTO_REAR: 'Кузов сзади',
  BODY_PHOTO_LEFT: 'Кузов слева',
  BODY_PHOTO_RIGHT: 'Кузов справа',
};

function date(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function RentalOperationTimeline({
  rentalId,
  operations,
}: {
  rentalId: string;
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
                  {operation.type === 'DEPOSIT_RETURN' ? null : operation.evidenceStatus === 'COMPLETE' ? (
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
                {operation.type === 'DEPOSIT_RETURN' && operation.depositAmountMinor ? (
                  <p className="text-sm">
                    Возвращено{' '}
                    <strong>
                      {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
                        (Number(operation.depositAmountMinor) - Number(operation.depositWithheldMinor ?? '0')) / 100,
                      )}
                    </strong>
                    {' · '}удержано{' '}
                    {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
                      Number(operation.depositWithheldMinor ?? '0') / 100,
                    )}
                    {operation.depositResolutionReason ? ` · ${operation.depositResolutionReason}` : ''}
                  </p>
                ) : null}
                {operation.type !== 'DEPOSIT_RETURN' && operation.evidenceMissingReason ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {operation.evidenceMissingReason}
                  </p>
                ) : null}
                {operation.media.length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {operation.media.map((media) => (
                      <Link
                        key={media.kind}
                        href={`/rentals/${rentalId}/operations/${operation.id}/media/${media.kind}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border px-3 text-sm font-semibold hover:bg-[var(--color-elevated)]"
                      >
                        {mediaLabels[media.kind]}
                      </Link>
                    ))}
                  </div>
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
