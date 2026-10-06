import Link from 'next/link';
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiEdit3,
  FiFileText,
  FiPhone,
  FiTruck,
  FiUser,
} from 'react-icons/fi';

import { DocumentsPanel } from '@/modules/client-documents/components/DocumentsPanel';
import type { ClientDocumentListItem } from '@/modules/client-documents/types';
import type { ClientDetailDto, ClientFineWorkspaceDto, ClientStatus } from '../types';
import type { ClientRentalWorkspaceDto } from '../types';
import type { ClientCommentDto } from '@/modules/client-comments/types';
import type { ClientRatingDto } from '@/modules/client-rating/queries';
import { ClientCommentsPanel } from '@/modules/client-comments/components/ClientCommentsPanel';
import { ClientRatingPanel } from '@/modules/client-rating/components/ClientRatingPanel';
import { ClientRatingStars } from '@/modules/client-rating/components/ClientRatingStars';
import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

import { ClientForm } from './ClientForm';
import { ClientFineWorkspace } from './ClientFineWorkspace';
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
const emptyFineWorkspace: ClientFineWorkspaceDto = {
  summary: { total: 0, unpaid: 0, unpaidAmountMinor: '0' },
  fines: [],
};
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value))
    : 'Нет данных';
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--color-border)] py-3 last:border-0">
      <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

type HistoryItem = {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
  tone: 'primary' | 'success' | 'neutral';
};

function clientHistory(
  client: ClientDetailDto,
  workspace: ClientRentalWorkspaceDto,
  comments: readonly ClientCommentDto[],
): HistoryItem[] {
  const items: HistoryItem[] = [
    {
      id: 'client-created',
      occurredAt: client.createdAt,
      title: 'Карточка клиента создана',
      description: 'Клиент добавлен в базу СУПА ПРО',
      tone: 'primary',
    },
  ];

  for (const comment of comments) {
    if (comment.hiddenAt) continue;
    items.push({
      id: `comment-${comment.id}`,
      occurredAt: comment.createdAt,
      title: 'Добавлен комментарий',
      description: `${comment.authorName}: ${comment.text}`,
      tone: 'neutral',
    });
  }

  for (const rental of workspace.rentals) {
    const label = [rental.vehicle.label, rental.vehicle.registrationNumber]
      .filter(Boolean)
      .join(' · ');
    const operationTypes = new Set(rental.operations.map((operation) => operation.type));
    if (!operationTypes.has('HANDOVER')) {
      items.push({
        id: `rental-start-${rental.id}`,
        occurredAt: rental.startsAt,
        title: 'Начало аренды',
        description: `${label} · ${rental.contractNumber ?? 'договор без номера'}`,
        tone: 'primary',
      });
    }
    for (const operation of rental.operations) {
      items.push({
        id: `operation-${operation.id}`,
        occurredAt: operation.occurredAt,
        title:
          operation.type === 'HANDOVER'
            ? 'Автомобиль выдан'
            : operation.type === 'RETURN'
              ? 'Автомобиль возвращён'
              : 'Аренда продлена',
        description: `${label} · ${operation.actorName}`,
        tone: operation.type === 'RETURN' ? 'success' : 'primary',
      });
    }
    if (rental.status === 'COMPLETED' && !operationTypes.has('RETURN')) {
      items.push({
        id: `rental-end-${rental.id}`,
        occurredAt: rental.endsAt,
        title: 'Аренда завершена',
        description: `${label} · ${rental.contractNumber ?? 'договор без номера'}`,
        tone: 'success',
      });
    }
  }

  return items.sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

function HistoryTimeline({ items }: { items: readonly HistoryItem[] }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <FiClock aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold">История клиента</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Фактические события по карточке и арендам
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-0">
          {items.map((item, index) => (
            <li key={item.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 size-2.5 shrink-0 rounded-full ring-4 ring-[var(--color-surface)] ${
                    item.tone === 'success'
                      ? 'bg-[var(--color-success)]'
                      : item.tone === 'primary'
                        ? 'bg-[var(--color-primary)]'
                        : 'bg-[var(--color-text-tertiary)]'
                  }`}
                />
                {index < items.length - 1 ? (
                  <span className="mt-1 min-h-8 w-px flex-1 bg-[var(--color-border)]" />
                ) : null}
              </div>
              <div className="min-w-0 pb-5 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold text-[var(--color-text)]">{item.title}</p>
                  <time className="text-xs whitespace-nowrap text-[var(--color-text-secondary)]">
                    {dateTime(item.occurredAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm break-words text-[var(--color-text-secondary)]">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
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
  fineWorkspace = emptyFineWorkspace,
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
  fineWorkspace?: ClientFineWorkspaceDto;
  comments?: ClientCommentDto[];
  currentUserId?: string;
  canHideAnyComment?: boolean;
  canManageRating?: boolean;
  rating?: ClientRatingDto | null;
}) {
  const highlightedRental =
    rentalWorkspace.rentals.find((rental) => rental.status === 'ACTIVE') ??
    rentalWorkspace.rentals[0] ??
    null;
  const history = clientHistory(client, rentalWorkspace, comments);
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="client-detail-page">
      <Link
        href="/clients"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiArrowLeft aria-hidden="true" />К клиентам
      </Link>
      <Card className="overflow-hidden">
        <CardContent className="grid gap-5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center">
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
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {client.phone ? (
                <a
                  href={`tel:${client.phone.replace(/\s/g, '')}`}
                  className="inline-flex min-h-8 items-center gap-2 font-medium text-[var(--color-primary)] hover:underline"
                >
                  <FiPhone aria-hidden="true" />
                  {client.phone}
                </a>
              ) : (
                <span className="inline-flex min-h-8 items-center gap-2 text-[var(--color-text-secondary)]">
                  <FiPhone aria-hidden="true" />
                  Нет телефона
                </span>
              )}
              {client.additionalPhone ? (
                <a
                  href={`tel:${client.additionalPhone.replace(/\s/g, '')}`}
                  className="inline-flex min-h-8 items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline"
                >
                  <span className="font-medium">Дополнительный телефон:</span>
                  {client.additionalPhone}
                </a>
              ) : null}
              <span className="inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
                <FiTruck aria-hidden="true" />
                Аренд:{' '}
                <strong className="text-[var(--color-text)]">
                  {rentalWorkspace.summary.total}
                </strong>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {canManage && rating ? <ClientRatingStars rating={rating} /> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManage ? (
                <a
                  href="#client-editor"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <FiEdit3 aria-hidden="true" />
                  Редактировать
                </a>
              ) : null}
              {canCreateRental ? (
                <Link
                  href={`/clients/${client.id}/rentals/new`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                >
                  Создать договор
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      <ClientWorkspaceTabs
        rentalCount={rentalWorkspace.summary.total}
        fineCount={fineWorkspace.summary.total}
        commentCount={comments.length}
        overview={
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2 font-bold">
                  <FiUser aria-hidden="true" className="text-[var(--color-primary)]" />
                  Основная информация
                </h2>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Основной телефон">
                    {client.phone ?? 'Нет телефона'}
                  </DetailRow>
                  <DetailRow label="Дополнительный телефон">
                    {client.additionalPhone ?? 'Не указан'}
                  </DetailRow>
                  <DetailRow label="Email">{client.email ?? 'Нет данных'}</DetailRow>
                  <DetailRow label="Дата рождения">{date(client.birthDate)}</DetailRow>
                  <DetailRow label="Создана карточка">{date(client.createdAt)}</DetailRow>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2 font-bold">
                  <FiFileText aria-hidden="true" className="text-[var(--color-primary)]" />
                  Паспорт РФ
                </h2>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Серия и номер паспорта">
                    {[client.passportSeries, client.passportNumber].filter(Boolean).join(' ') ||
                      client.passport ||
                      'Нет данных'}
                  </DetailRow>
                  <DetailRow label="Кем выдан паспорт">
                    {client.passportIssuedBy || 'Нет данных'}
                  </DetailRow>
                  <DetailRow label="Дата выдачи паспорта">
                    {date(client.passportIssuedAt ?? null)}
                  </DetailRow>
                  <DetailRow label="Код подразделения">
                    {client.passportDivisionCode || 'Нет данных'}
                  </DetailRow>
                  <DetailRow label="Адрес регистрации">
                    {client.registrationAddress || 'Нет данных'}
                  </DetailRow>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2 font-bold">
                  <FiCreditCard aria-hidden="true" className="text-[var(--color-primary)]" />
                  Водительское удостоверение
                </h2>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Серия и номер">
                    {client.driverLicense ?? 'Нет данных'}
                  </DetailRow>
                  <DetailRow label="Дата выдачи">{date(client.driverLicenseIssuedAt)}</DetailRow>
                  <DetailRow label="Действует до">{date(client.driverLicenseExpiresAt)}</DetailRow>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2 font-bold">
                  <FiTruck aria-hidden="true" className="text-[var(--color-primary)]" />
                  {highlightedRental?.status === 'ACTIVE' ? 'Текущая аренда' : 'Последняя аренда'}
                </h2>
              </CardHeader>
              <CardContent>
                {highlightedRental ? (
                  <div className="grid gap-3">
                    <div>
                      <Link
                        href={`/rentals/${highlightedRental.id}`}
                        className="font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        {highlightedRental.vehicle.label}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {highlightedRental.vehicle.registrationNumber ?? 'Без госномера'} ·{' '}
                        {highlightedRental.contractNumber ?? 'Договор без номера'}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <FiCalendar
                          aria-hidden="true"
                          className="text-[var(--color-text-secondary)]"
                        />
                        {date(highlightedRental.startsAt)} — {date(highlightedRental.endsAt)}
                      </p>
                      <p className="flex items-center gap-2">
                        <FiCheckCircle aria-hidden="true" className="text-[var(--color-success)]" />
                        {highlightedRental.status === 'ACTIVE'
                          ? 'Автомобиль у клиента'
                          : highlightedRental.status === 'COMPLETED'
                            ? 'Аренда завершена'
                            : 'Статус договора обновлён'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid place-items-center gap-2 py-6 text-center">
                    <span className="grid size-11 place-items-center rounded-full bg-[var(--color-elevated)] text-[var(--color-text-secondary)]">
                      <FiTruck aria-hidden="true" />
                    </span>
                    <p className="font-semibold">Аренд пока нет</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      История договоров появится после первой аренды.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            <HistoryTimeline items={history} />
            {canManage ? (
              <div id="client-editor" className="scroll-mt-24 xl:col-span-2">
                <ClientForm companies={companies} client={client} />
              </div>
            ) : null}
          </div>
        }
        rentals={<ClientRentalHistory workspace={rentalWorkspace} />}
        fines={<ClientFineWorkspace clientId={client.id} workspace={fineWorkspace} />}
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
