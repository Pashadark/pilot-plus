'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { FiCamera, FiCheckCircle, FiFileText } from 'react-icons/fi';

import { uploadClientDocumentAction } from '@/modules/client-documents/actions';
import { DocumentDropzone } from '@/modules/client-documents/components/DocumentDropzone';
import type {
  ClientDocumentActionState,
  ClientDocumentListItem,
} from '@/modules/client-documents/types';
import {
  ClientDocumentAutofillDialog,
  type ClientAutofillFiles,
} from '@/modules/clients/components/ClientDocumentAutofillDialog';
import { Button } from '@/shared/ui';

type SlotKey = 'passportMain' | 'passportRegistration' | 'driverLicense';

const slots: readonly {
  key: SlotKey;
  category: 'PASSPORT' | 'DRIVER_LICENSE';
  title: string;
  required: boolean;
}[] = [
  { key: 'passportMain', category: 'PASSPORT', title: 'Паспорт — основной разворот', required: true },
  {
    key: 'passportRegistration',
    category: 'PASSPORT',
    title: 'Паспорт — регистрация',
    required: false,
  },
  {
    key: 'driverLicense',
    category: 'DRIVER_LICENSE',
    title: 'Водительское удостоверение',
    required: true,
  },
];

const statusLabel: Record<ClientDocumentListItem['status'], string> = {
  UPLOADING: 'Загружается',
  PENDING: 'Проверяется',
  CLEAN: 'Проверен',
  BLOCKED: 'Заблокирован',
  ERROR: 'Ошибка проверки',
  ARCHIVED: 'В архиве',
};

function statusTone(status: ClientDocumentListItem['status']) {
  if (status === 'CLEAN') return 'text-[var(--color-success)] bg-[var(--color-success-soft)]';
  if (status === 'UPLOADING' || status === 'PENDING') {
    return 'text-[var(--color-warning)] bg-[var(--color-warning-soft)]';
  }
  return 'text-[var(--color-danger)] bg-[var(--color-danger-soft)]';
}

function provisionalDocument(
  id: string,
  category: 'PASSPORT' | 'DRIVER_LICENSE',
  title: string,
  file: File,
  status: ClientDocumentListItem['status'],
): ClientDocumentListItem {
  const now = new Date().toISOString();
  return {
    id,
    category,
    title,
    status,
    currentVersion: 1,
    originalName: file.name,
    verifiedMime: file.type || null,
    bytes: file.size,
    createdAt: now,
    updatedAt: now,
  };
}

type DocumentsSectionProps = {
  clientId?: string;
  clientName?: string;
  documents: readonly ClientDocumentListItem[];
  onReadinessChange(ready: boolean): void;
};

export function DocumentsSection(props: DocumentsSectionProps) {
  const revision = props.documents
    .map((document) => `${document.id}:${document.status}:${document.updatedAt}`)
    .join('|');
  return (
    <DocumentsSectionContent
      key={`${props.clientId ?? 'no-client'}:${revision}`}
      {...props}
    />
  );
}

function DocumentsSectionContent({
  clientId,
  clientName,
  documents,
  onReadinessChange,
}: DocumentsSectionProps) {
  const [items, setItems] = useState([...documents]);
  const [files, setFiles] = useState<Partial<Record<SlotKey, File>>>({});
  const [errors, setErrors] = useState<Partial<Record<SlotKey, string>>>({});
  const [uploading, setUploading] = useState<SlotKey | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [, startTransition] = useTransition();

  const ready = useMemo(() => {
    const clean = new Set(
      items.filter((item) => item.status === 'CLEAN').map((item) => item.category),
    );
    return clean.has('PASSPORT') && clean.has('DRIVER_LICENSE');
  }, [items]);

  useEffect(() => onReadinessChange(ready), [onReadinessChange, ready]);

  function upload(slot: (typeof slots)[number]) {
    const file = files[slot.key];
    if (!clientId || !file) return;
    const temporaryId = `upload-${slot.key}`;
    setUploading(slot.key);
    setErrors((current) => ({ ...current, [slot.key]: undefined }));
    setItems((current) => [
      provisionalDocument(temporaryId, slot.category, slot.title, file, 'UPLOADING'),
      ...current.filter((item) => item.id !== temporaryId),
    ]);
    startTransition(async () => {
      const payload = new FormData();
      payload.set('clientId', clientId);
      payload.set('uploadId', crypto.randomUUID());
      payload.set('category', slot.category);
      payload.set('title', slot.title);
      payload.set('file', file);
      const result = await uploadClientDocumentAction(
        { status: 'idle' } satisfies ClientDocumentActionState,
        payload,
      );
      const nextStatus: ClientDocumentListItem['status'] =
        result.status === 'success' ? 'CLEAN' : result.status === 'pending' ? 'PENDING' : 'ERROR';
      const nextId = ('documentId' in result ? result.documentId : undefined) ?? temporaryId;
      setItems((current) => [
        provisionalDocument(nextId, slot.category, slot.title, file, nextStatus),
        ...current.filter((item) => item.id !== temporaryId && item.id !== nextId),
      ]);
      if (result.status === 'error') {
        setErrors((current) => ({ ...current, [slot.key]: result.message }));
      } else {
        setFiles((current) => ({ ...current, [slot.key]: undefined }));
      }
      setUploading(null);
    });
  }

  function applyAutofill(_fields: Record<string, string>, nextFiles: ClientAutofillFiles) {
    setFiles(nextFiles);
  }

  return (
    <section className="grid gap-4" aria-labelledby="constructor-documents-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="constructor-documents-title" className="text-lg font-bold">
            Документы клиента
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Паспорт и водительское удостоверение проходят антивирусную проверку.
          </p>
        </div>
        {clientId ? (
          <Button
            type="button"
            variant="soft"
            size="sm"
            leadingIcon={<FiCamera aria-hidden />}
            onClick={() => setAutofillOpen(true)}
          >
            Распознать по фото
          </Button>
        ) : null}
      </div>

      {!clientId ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-3 text-sm">
          Сначала выберите или создайте клиента.
        </p>
      ) : (
        <div
          className={`flex items-center gap-2 rounded-[var(--radius-md)] p-3 text-sm font-semibold ${
            ready
              ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
              : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
          }`}
        >
          {ready ? <FiCheckCircle aria-hidden /> : <FiFileText aria-hidden />}
          {ready ? 'Документы готовы' : `Документы для ${clientName ?? 'клиента'} ещё не готовы`}
        </div>
      )}

      <div className="grid gap-3">
        {slots.map((slot) => {
          const existing = items.find(
            (item) =>
              item.category === slot.category &&
              (slot.key !== 'passportRegistration' ||
                item.title.toLocaleLowerCase('ru-RU').includes('регистрац')),
          );
          const busy = uploading === slot.key;
          return (
            <article
              key={slot.key}
              className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">{slot.title}</h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {slot.required ? 'Обязательный документ' : 'Рекомендуется для договора'}
                  </p>
                </div>
                {existing ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(existing.status)}`}
                  >
                    {statusLabel[existing.status]}
                  </span>
                ) : null}
              </div>
              <DocumentDropzone
                id={`constructor-${slot.key}`}
                label={slot.title}
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                hint="JPG, PNG, WebP или PDF до 15 МБ"
                file={files[slot.key] ?? null}
                busy={busy}
                disabled={!clientId}
                error={errors[slot.key]}
                onFileSelect={(file) =>
                  setFiles((current) => ({ ...current, [slot.key]: file ?? undefined }))
                }
              />
              <Button
                type="button"
                size="sm"
                loading={busy}
                disabled={!clientId || !files[slot.key] || busy}
                onClick={() => upload(slot)}
                className="w-fit"
              >
                {existing ? 'Заменить файл' : 'Загрузить файл'}
              </Button>
            </article>
          );
        })}
      </div>

      <ClientDocumentAutofillDialog
        open={autofillOpen}
        onOpenChange={setAutofillOpen}
        onApply={applyAutofill}
      />
    </section>
  );
}
