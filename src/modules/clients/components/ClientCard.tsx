import Link from 'next/link';
import { FiSend } from 'react-icons/fi';

import type { ClientCardDto, ClientStatus } from '../types';
import { Badge, Card } from '@/shared/ui';

import { ClientPhoto } from './ClientPhoto';

const statusView: Record<
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
}: {
  client: ClientCardDto;
  localPhotoUrl?: string | null;
  messenger?: ClientMessenger;
}) {
  const status = statusView[client.status];
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
                {client.phoneMasked}
              </p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <dl className="mt-3 grid gap-1 text-sm text-[var(--color-text-secondary)]">
            {client.email ? <div className="truncate">{client.email}</div> : null}
            <div>
              {client.driverLicenseMasked ? `ВУ: ${client.driverLicenseMasked}` : 'ВУ: нет данных'}
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
