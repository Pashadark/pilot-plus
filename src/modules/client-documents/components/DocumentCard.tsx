'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import {
  FiAlertCircle,
  FiArchive,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiImage,
  FiRefreshCw,
} from 'react-icons/fi';

import {
  archiveClientDocumentAction,
  uploadClientDocumentAction,
} from '@/modules/client-documents/actions';
import type {
  ClientDocumentActionState,
  ClientDocumentListItem,
  DocumentScanStatus,
} from '@/modules/client-documents/types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button } from '@/shared/ui';

import { DocumentDropzone } from './DocumentDropzone';

const idle: ClientDocumentActionState = { status: 'idle' };

const statusView: Record<
  DocumentScanStatus,
  {
    label: string;
    tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    icon: typeof FiClock;
  }
> = {
  UPLOADING: { label: 'Загружается', tone: 'info', icon: FiClock },
  PENDING: { label: 'Проверяется', tone: 'warning', icon: FiClock },
  CLEAN: { label: 'Проверен', tone: 'success', icon: FiCheckCircle },
  BLOCKED: { label: 'Заблокирован', tone: 'danger', icon: FiAlertCircle },
  ERROR: { label: 'Ошибка проверки', tone: 'danger', icon: FiAlertCircle },
  ARCHIVED: { label: 'В архиве', tone: 'neutral', icon: FiArchive },
};

const categoryLabels: Record<ClientDocumentListItem['category'], string> = {
  PASSPORT: 'Паспорт',
  DRIVER_LICENSE: 'Водительское удостоверение',
  CONTRACT: 'Договор',
  POWER_OF_ATTORNEY: 'Доверенность',
  MEDICAL: 'Медицинский документ',
  OTHER: 'Прочее',
};

function formatBytes(bytes: number | null) {
  if (bytes === null) return 'Размер уточняется';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value));
}

function resultError(state: ClientDocumentActionState) {
  return state.status === 'error' ? state.message : undefined;
}

function ReplacementForm({
  id,
  clientId,
  document,
  onDone,
}: {
  id: string;
  clientId: string;
  document: ClientDocumentListItem;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: ClientDocumentActionState, formData: FormData) => {
      if (file) formData.set('file', file);
      formData.set('uploadId', crypto.randomUUID());
      const next = await uploadClientDocumentAction(previous, formData);
      if (next.status !== 'idle') {
        showToast({
          tone: next.status === 'success' ? 'success' : next.status === 'error' ? 'danger' : 'info',
          title: next.message,
        });
      }
      if (next.status === 'success') {
        setFile(null);
        onDone();
      }
      return next;
    },
    idle,
  );

  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>('input[type="file"], button:not([disabled])')
      ?.focus();
  }, []);

  return (
    <form
      id={id}
      ref={formRef}
      role="region"
      aria-label={`Замена документа «${document.title}»`}
      action={action}
      className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-3"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="documentId" value={document.id} />
      <input type="hidden" name="category" value={document.category} />
      <input type="hidden" name="title" value={document.title} />
      <DocumentDropzone
        id={`replacement-${document.id}`}
        label={`Новый файл для «${document.title}»`}
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        file={file}
        busy={pending}
        error={resultError(state)}
        onFileSelect={setFile}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={pending} disabled={!file}>
          Загрузить замену
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

export function DocumentCard({
  clientId,
  document,
  canManage,
  canArchive,
}: {
  clientId: string;
  document: ClientDocumentListItem;
  canManage: boolean;
  canArchive: boolean;
}) {
  const { showToast } = useToast();
  const [replacing, setReplacing] = useState(false);
  const replacementTriggerRef = useRef<HTMLButtonElement>(null);
  const [archiveState, archiveAction, archivePending] = useActionState(
    async (previous: ClientDocumentActionState, formData: FormData) => {
      const next = await archiveClientDocumentAction(previous, formData);
      if (next.status !== 'idle') {
        showToast({
          tone: next.status === 'success' ? 'success' : 'danger',
          title: next.message,
        });
      }
      return next;
    },
    idle,
  );
  const view = statusView[document.status];
  const StatusIcon = view.icon;
  const isClean = document.status === 'CLEAN';
  const isImage = Boolean(document.verifiedMime?.startsWith('image/'));
  const isPdf = document.verifiedMime === 'application/pdf';
  const downloadUrl = `/clients/${clientId}/documents/${document.id}/download`;
  const previewUrl = `${downloadUrl}?preview=1&v=${document.currentVersion}`;
  const replacementId = `document-replacement-${document.id}`;
  const closeReplacement = () => {
    setReplacing(false);
    queueMicrotask(() => replacementTriggerRef.current?.focus());
  };

  return (
    <article
      className="grid min-w-0 gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      data-document-status={document.status}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {isImage ? (
            <FiImage
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 text-[var(--color-primary)]"
            />
          ) : (
            <FiFileText
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 text-[var(--color-primary)]"
            />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold break-words">{document.title}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {isPdf ? 'PDF' : isImage ? 'Изображение' : 'Файл'} ·{' '}
              {categoryLabels[document.category]}
            </p>
          </div>
        </div>
        <span role="status" aria-live="polite" aria-label={`Статус документа: ${view.label}`}>
          <Badge tone={view.tone} className="gap-1.5">
            <StatusIcon aria-hidden="true" className="size-3.5" />
            {view.label}
          </Badge>
        </span>
      </div>

      {isClean && isImage ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="block aspect-[16/9] min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {/* Защищённый preview route требует session cookie текущего браузера. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={previewUrl}
            src={previewUrl}
            alt={`Предпросмотр документа «${document.title}»`}
            width={640}
            height={360}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </a>
      ) : null}

      <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Файл</dt>
          <dd className="min-w-0 break-all" title={document.originalName ?? undefined}>
            {document.originalName ?? 'Имя уточняется'}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">Размер</dt>
          <dd>{formatBytes(document.bytes)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-secondary)]">Обновлён</dt>
          <dd>{formatDate(document.updatedAt)}</dd>
        </div>
      </dl>

      {document.status === 'BLOCKED' ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          Файл заблокирован антивирусом и недоступен для просмотра или скачивания.
        </p>
      ) : document.status === 'ERROR' ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          Проверка временно недоступна. Система автоматически повторит проверку; файл пока
          недоступен.
        </p>
      ) : document.status === 'PENDING' || document.status === 'UPLOADING' ? (
        <p role="status" className="text-sm text-[var(--color-text-secondary)]">
          Файл станет доступен только после успешной антивирусной проверки.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
        {isClean ? (
          <>
            <a
              href={downloadUrl}
              download
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none"
            >
              <FiDownload aria-hidden="true" />
              Скачать
            </a>
            {isPdf ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                <FiExternalLink aria-hidden="true" />
                Предпросмотр
              </a>
            ) : null}
          </>
        ) : null}
        {canManage && isClean ? (
          <Button
            ref={replacementTriggerRef}
            type="button"
            size="sm"
            variant="soft"
            aria-expanded={replacing}
            aria-controls={replacementId}
            aria-label={`Заменить документ «${document.title}»`}
            leadingIcon={<FiRefreshCw aria-hidden="true" />}
            onClick={() => (replacing ? closeReplacement() : setReplacing(true))}
          >
            Заменить
          </Button>
        ) : null}
        {canArchive ? (
          <form
            action={archiveAction}
            onSubmit={(event) => {
              if (!window.confirm(`Архивировать документ «${document.title}»?`)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="documentId" value={document.id} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              loading={archivePending}
              aria-label={`Архивировать документ «${document.title}»`}
              leadingIcon={<FiArchive aria-hidden="true" />}
            >
              Архивировать
            </Button>
          </form>
        ) : null}
      </div>
      {replacing ? (
        <ReplacementForm
          id={replacementId}
          clientId={clientId}
          document={document}
          onDone={closeReplacement}
        />
      ) : null}
      {archiveState.status === 'error' ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {archiveState.message}
        </p>
      ) : null}
    </article>
  );
}
