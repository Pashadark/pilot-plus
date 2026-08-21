import Link from 'next/link';
import { FiDownload, FiFileText } from 'react-icons/fi';

import type { ClientRentalWorkspaceDto } from '../types';
import { Badge, Card, CardContent } from '@/shared/ui';

const statusLabels = {
  DRAFT: 'Черновик',
  CONFIRMED: 'Подтверждён',
  ACTIVE: 'Активен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};
function money(minor: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(BigInt(minor)) / 100);
}
function date(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value));
}

export function ClientRentalHistory({ workspace }: { workspace: ClientRentalWorkspaceDto }) {
  if (!workspace.rentals.length)
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
            У клиента пока нет сохранённых аренд.
          </p>
        </CardContent>
      </Card>
    );
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Всего аренд', workspace.summary.total],
          ['Активные', workspace.summary.active],
          ['Завершённые', workspace.summary.completed],
          ['Общая сумма', money(workspace.summary.totalMinor)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3">
        {workspace.rentals.map((rental) => (
          <Card key={rental.id}>
            <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/rentals/${rental.id}`}
                    className="font-bold text-[var(--color-primary)] hover:underline"
                  >
                    {rental.contractNumber ?? 'Черновик договора'}
                  </Link>
                  <Badge
                    tone={
                      rental.status === 'CANCELLED'
                        ? 'danger'
                        : rental.status === 'COMPLETED'
                          ? 'success'
                          : 'neutral'
                    }
                  >
                    {statusLabels[rental.status]}
                  </Badge>
                </div>
                <p className="mt-2 font-semibold">{rental.vehicle.label}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {rental.vehicle.registrationNumber ?? 'Без госномера'} · {date(rental.startsAt)} —{' '}
                  {date(rental.endsAt)} · {rental.billableDays} дн.
                </p>
                <p className="mt-2 text-sm">
                  Аренда: <strong>{money(rental.totalPriceMinor)}</strong> · Залог:{' '}
                  <strong>{money(rental.depositMinor)}</strong>
                </p>
                {rental.operations.length ? (
                  <div className="mt-3 grid gap-1 border-l-2 border-[var(--color-border)] pl-3 text-sm">
                    {rental.operations.map((operation) => (
                      <p key={operation.id}>
                        <strong>
                          {operation.type === 'HANDOVER'
                            ? 'Выдача'
                            : operation.type === 'RETURN'
                              ? 'Возврат'
                              : 'Продление'}
                        </strong>{' '}
                        · {date(operation.occurredAt)} · {operation.actorName}
                        {operation.mileageKm === null ? '' : ` · ${operation.mileageKm} км`}
                        {operation.fuelLevelPercent === null
                          ? ''
                          : ` · топливо ${operation.fuelLevelPercent}%`}
                        {operation.evidenceStatus === 'COMPLETE'
                          ? ''
                          : ` · без полной фиксации: ${operation.evidenceMissingReason ?? 'причина не указана'}`}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {rental.documents.map((document) => (
                  <Link
                    key={`${document.version}-${document.format}`}
                    href={`/rentals/${rental.id}/documents/${document.version}/${document.format}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-elevated)]"
                  >
                    {document.format === 'PDF' ? (
                      <FiFileText aria-hidden="true" />
                    ) : (
                      <FiDownload aria-hidden="true" />
                    )}{' '}
                    Скачать {document.format}
                  </Link>
                ))}
                {rental.documents.length === 0 ? (
                  <Link
                    href={`/rentals/${rental.id}`}
                    className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] bg-[var(--color-elevated)] px-3 text-sm font-semibold text-[var(--color-text-secondary)]"
                  >
                    Документы ещё не сформированы
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
