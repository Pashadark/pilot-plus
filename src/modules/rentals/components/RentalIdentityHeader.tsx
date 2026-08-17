'use client';

import Link from 'next/link';
import { FiCopy, FiExternalLink } from 'react-icons/fi';

import type { RentalDetailView } from './rental-detail-presentation';

import { useToast } from '@/shared/providers/ToastProvider';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { PageHeader } from '@/shared/ui/PageHeader';

const linkButtonClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

export function RentalIdentityHeader({ detail }: { detail: RentalDetailView }) {
  const { showToast } = useToast();

  async function copyId() {
    await navigator.clipboard.writeText(detail.id);
    showToast({ tone: 'success', title: 'ID договора скопирован.' });
  }

  return (
    <section className="grid min-w-0 gap-4" aria-labelledby="rental-title">
      <PageHeader
        titleId="rental-title"
        eyebrow={detail.source.label}
        title={detail.contractNumber}
        description={
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge tone={detail.status.tone} size="md">
              {detail.status.label}
            </Badge>
            <span className="font-mono text-xs break-all">ID: {detail.id}</span>
          </span>
        }
        actions={
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<FiCopy aria-hidden="true" />}
            aria-label="Копировать ID договора"
            onClick={copyId}
          >
            Копировать ID
          </Button>
        }
      />
      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
        {detail.source.description}
      </p>
      <nav aria-label="Связанные записи" className="flex flex-wrap gap-2">
        <Link className={linkButtonClass} href={`/clients/${detail.client.id}`}>
          Клиент: {detail.client.label}
          <FiExternalLink aria-hidden="true" />
        </Link>
        <Link className={linkButtonClass} href={`/vehicles/${detail.vehicle.id}`}>
          Автомобиль: {detail.vehicle.label}
          <FiExternalLink aria-hidden="true" />
        </Link>
      </nav>
    </section>
  );
}
