import Link from 'next/link';
import { FiSend } from 'react-icons/fi';

import type { ClientCardDto, ClientStatus } from '../types';
import type { ClientRatingSummary } from '@/modules/client-rating/types';
import { Badge, Card } from '@/shared/ui';

import { ClientPhoto } from './ClientPhoto';
import { ClientRatingStars } from '@/modules/client-rating/components/ClientRatingStars';
import { formatMinorMoney, presentClientDeposit } from './client-deposit';

function withoutMiddleDots(value: string) {
  return value.replace(/\s*·\s*/g, ' ');
}

export const clientStatusView: Record<
  ClientStatus,
  { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }
> = {
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  NEW: { label: 'Новый', tone: 'neutral' },
  VERIFYING: { label: 'На проверке', tone: 'warning' },
  VERIFIED: { label: 'Проверен', tone: 'success' },
  REGULAR: { label: 'Постоянный', tone: 'success' },
  BLOCKED: { label: 'Заблокирован', tone: 'danger' },
  ARCHIVED: { label: 'В архиве', tone: 'neutral' },
};

export type ClientMessenger = {
  type: 'telegram';
  href: string;
  confirmedAvatarUrl?: string | null;
};

export function ClientCard({
  client,
  localPhotoUrl,
  messenger,
  rating,
}: {
  client: ClientCardDto;
  localPhotoUrl?: string | null;
  messenger?: ClientMessenger;
  rating?: ClientRatingSummary;
}) {
  const status = clientStatusView[client.status];
  const deposit = presentClientDeposit(
    client.rentalSummary.current ?? client.rentalSummary.last,
    Boolean(client.rentalSummary.current),
  );
  const selectedRental = client.rentalSummary.current ?? client.rentalSummary.last;
  const resolvedMessenger =
    messenger ??
    (client.telegramUrl
      ? { type: 'telegram' as const, href: client.telegramUrl, confirmedAvatarUrl: null }
      : undefined);

  return (
    <Card className="min-w-0 overflow-hidden transition-[border-color,box-shadow,transform] duration-[var(--motion-fast)] hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-floating)]">
      <article
        data-testid="client-card"
        className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 p-4"
      >
        <ClientPhoto
          name={client.fullName}
          localPhotoUrl={localPhotoUrl ?? client.localPhotoUrl}
          confirmedMessengerAvatarUrl={resolvedMessenger?.confirmedAvatarUrl}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold break-words">
                <Link
                  href={`/clients/${client.id}`}
                  className="rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                >
                  {client.fullName}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {client.phone ?? 'Нет телефона'}
              </p>
              {client.additionalPhone ? (
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Доп.: {client.additionalPhone}
                </p>
              ) : null}
              {rating ? (
                <div className="mt-2">
                  <ClientRatingStars rating={rating} compact />
                </div>
              ) : null}
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <dl className="mt-3 grid gap-1 text-sm text-[var(--color-text-secondary)]">
            <div>
              Аренд:{' '}
              <strong className="text-[var(--color-text)]">{client.rentalSummary.total}</strong>
            </div>
            <div>
              Штрафы:{' '}
              <strong className="text-[var(--color-text)]">{client.fineSummary.total}</strong>
            </div>
            <div>
              Оплачено:{' '}
              <strong className="text-[var(--color-text)]">
                {formatMinorMoney(client.fineSummary.paidAmountMinor)}
              </strong>
            </div>
            {selectedRental ? (
              <div className="grid gap-0.5">
                <span>{withoutMiddleDots(selectedRental.vehicle.label)}</span>
                <span>{selectedRental.vehicle.registrationNumber ?? 'Без номера'}</span>
                {selectedRental.contractNumber ? <span>{selectedRental.contractNumber}</span> : null}
              </div>
            ) : (
              <div>Нет аренды</div>
            )}
            <div>
              Стоимость:{' '}
              <strong className="text-[var(--color-text)]">
                {selectedRental ? formatMinorMoney(selectedRental.totalPriceMinor) : '—'}
              </strong>
            </div>
            <div>
              Сумма депозита:{' '}
              <strong className="text-[var(--color-text)]">{deposit.amount}</strong>
            </div>
            {deposit.label ? <div>Депозит: <strong className="text-[var(--color-text)]">{deposit.label}</strong></div> : null}
            <div>
              Дата возврата:{' '}
              <strong className="text-[var(--color-text)]">{deposit.returnedAtLabel}</strong>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/clients/${client.id}`}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              Открыть
            </Link>
            {resolvedMessenger ? (
              <a
                href={resolvedMessenger.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Написать в Telegram"
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                <FiSend aria-hidden="true" /> Написать в Telegram
              </a>
            ) : null}
          </div>
        </div>
      </article>
    </Card>
  );
}
