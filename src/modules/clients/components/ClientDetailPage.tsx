import Link from 'next/link';
import { FiArrowLeft, FiFileText, FiPhone } from 'react-icons/fi';

import { DocumentsPanel } from '@/modules/client-documents/components/DocumentsPanel';
import type { ClientDocumentListItem } from '@/modules/client-documents/types';
import type { ClientDetailDto, ClientStatus } from '../types';
import type { ClientRentalWorkspaceDto } from '../types';
import type { ClientCommentDto } from '@/modules/client-comments/types';
import type { ClientRatingDto } from '@/modules/client-rating/queries';
import { ClientCommentsPanel } from '@/modules/client-comments/components/ClientCommentsPanel';
import { ClientRatingPanel } from '@/modules/client-rating/components/ClientRatingPanel';
import { ClientRatingStars } from '@/modules/client-rating/components/ClientRatingStars';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

import { ClientForm } from './ClientForm';
import { ClientPhoto } from './ClientPhoto';
import { ClientRentalHistory } from './ClientRentalHistory';
import { ClientWorkspaceTabs } from './ClientWorkspaceTabs';

const labels: Record<ClientStatus, string> = {
  DRAFT: 'Черновик',
  NEW: 'Новый',
  VERIFYING: 'На проверке',
  VERIFIED: 'Проверен',
  REGULAR: 'Постоянный',
  BLOCKED: 'Заблокирован',
  ARCHIVED: 'В архиве',
};
const emptyRentalWorkspace: ClientRentalWorkspaceDto = {
  summary: { total: 0, active: 0, completed: 0, totalMinor: '0' },
  rentals: [],
};
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value))
    : 'Нет данных';
}
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--color-border)] py-3 last:border-0">
      <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

export function ClientDetailPage({
  client,
  canManage,
  canArchiveDocuments,
  documents,
  companies,
  canCreateRental = false,
  rentalWorkspace = emptyRentalWorkspace,
  comments = [],
  currentUserId = '',
  canHideAnyComment = false,
  canManageRating = false,
  rating = null,
}: {
  client: ClientDetailDto;
  canManage: boolean;
  canArchiveDocuments: boolean;
  documents: readonly ClientDocumentListItem[];
  companies: readonly { id: string; name: string }[];
  canCreateRental?: boolean;
  rentalWorkspace?: ClientRentalWorkspaceDto;
  comments?: ClientCommentDto[];
  currentUserId?: string;
  canHideAnyComment?: boolean;
  canManageRating?: boolean;
  rating?: ClientRatingDto | null;
}) {
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="client-detail-page">
      <Link
        href="/clients"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiArrowLeft aria-hidden="true" />К клиентам
      </Link>
      <Card>
        <CardContent className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4">
          <ClientPhoto name={client.fullName} localPhotoUrl={client.localPhotoUrl} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">
                {client.fullName}
              </h1>
              <Badge
                tone={
                  client.status === 'BLOCKED'
                    ? 'danger'
                    : client.status === 'VERIFIED' || client.status === 'REGULAR'
                      ? 'success'
                      : 'neutral'
                }
              >
                {labels[client.status]}
              </Badge>
            </div>
            <a
              href={`tel:${client.phone.replace(/\s/g, '')}`}
              className="mt-2 inline-flex min-h-11 items-center gap-2 text-[var(--color-primary)] hover:underline"
            >
              <FiPhone aria-hidden="true" />
              {client.phone}
            </a>
            {canManage && rating ? (
              <div className="mt-2">
                <ClientRatingStars rating={rating} />
              </div>
            ) : null}
            {canCreateRental ? (
              <Link
                href={`/clients/${client.id}/rentals/new`}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                Создать договор
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <ClientWorkspaceTabs
        rentalCount={rentalWorkspace.summary.total}
        commentCount={comments.length}
        overview={
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="font-bold">Обзор</h2>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Email">{client.email ?? 'Нет данных'}</DetailRow>
                  <DetailRow label="Дата рождения">{date(client.birthDate)}</DetailRow>
                  <DetailRow label="Создана карточка">{date(client.createdAt)}</DetailRow>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2 font-bold">
                  <FiFileText aria-hidden="true" />
                  Реквизиты документов
                </h2>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Паспорт">{client.passport ?? 'Нет данных'}</DetailRow>
                  <DetailRow label="Водительское удостоверение">
                    {client.driverLicense ?? 'Нет данных'}
                  </DetailRow>
                  <DetailRow label="Выдано">{date(client.driverLicenseIssuedAt)}</DetailRow>
                  <DetailRow label="Действует до">{date(client.driverLicenseExpiresAt)}</DetailRow>
                </dl>
              </CardContent>
            </Card>
            {canManage ? (
              <div className="xl:col-span-2">
                <ClientForm companies={companies} client={client} />
              </div>
            ) : null}
          </div>
        }
        rentals={<ClientRentalHistory workspace={rentalWorkspace} />}
        documents={
          <DocumentsPanel
            clientId={client.id}
            clientName={client.fullName}
            documents={documents}
            canManage={canManage}
            canArchive={canArchiveDocuments}
          />
        }
        comments={
          <div className="grid gap-5">
            {canManage && rating ? <ClientRatingPanel rating={rating} /> : null}
            <ClientCommentsPanel
              clientId={client.id}
              comments={comments}
              rentals={rentalWorkspace.rentals.map((rental) => ({
                id: rental.id,
                label: rental.contractNumber ?? rental.vehicle.label,
              }))}
              canManage={canManage}
              canManageRating={canManageRating}
              currentUserId={currentUserId}
              canHideAny={canHideAnyComment}
            />
          </div>
        }
      />
    </main>
  );
}
