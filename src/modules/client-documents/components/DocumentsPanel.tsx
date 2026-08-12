'use client';

import { useActionState, useState } from 'react';
import { FiCamera, FiFilePlus } from 'react-icons/fi';

import {
  uploadClientDocumentAction,
  uploadClientPhotoAction,
} from '@/modules/client-documents/actions';
import type {
  ClientDocumentActionState,
  ClientDocumentListItem,
} from '@/modules/client-documents/types';
import { useToast } from '@/shared/providers/ToastProvider';
import { Button, Card, CardContent, CardHeader, EmptyState, Input, Select } from '@/shared/ui';

import { DocumentCard } from './DocumentCard';
import { DocumentDropzone } from './DocumentDropzone';

const idle: ClientDocumentActionState = { status: 'idle' };

const categories: readonly { value: ClientDocumentListItem['category']; label: string }[] = [
  { value: 'PASSPORT', label: 'Паспорт' },
  { value: 'DRIVER_LICENSE', label: 'Водительское удостоверение' },
  { value: 'CONTRACT', label: 'Договор' },
  { value: 'POWER_OF_ATTORNEY', label: 'Доверенность' },
  { value: 'MEDICAL', label: 'Медицинский документ' },
  { value: 'OTHER', label: 'Прочее' },
];

function stateError(state: ClientDocumentActionState) {
  return state.status === 'error' ? state.message : undefined;
}

function PhotoUploadForm({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: ClientDocumentActionState, formData: FormData) => {
      if (file) formData.set('file', file);
      formData.set('uploadId', crypto.randomUUID());
      const next = await uploadClientPhotoAction(previous, formData);
      if (next.status !== 'idle') {
        showToast({
          tone: next.status === 'success' ? 'success' : next.status === 'error' ? 'danger' : 'info',
          title: next.message,
        });
      }
      if (next.status === 'success') setFile(null);
      return next;
    },
    idle,
  );

  return (
    <form
      action={action}
      className="grid gap-3 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <h3 className="flex items-center gap-2 font-semibold">
        <FiCamera aria-hidden="true" className="text-[var(--color-primary)]" />
        Фотография профиля
      </h3>
      <DocumentDropzone
        id={`client-photo-${clientId}`}
        label="Фотография клиента"
        accept=".jpg,.jpeg,.png,.webp"
        hint={`JPG, PNG или WebP до 15 МБ. После проверки фото появится в профиле ${clientName}.`}
        file={file}
        busy={pending}
        error={stateError(state)}
        onFileSelect={setFile}
      />
      <Button type="submit" size="sm" loading={pending} disabled={!file} className="w-fit">
        Обновить фотографию
      </Button>
    </form>
  );
}

function NewDocumentForm({ clientId }: { clientId: string }) {
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
      if (next.status === 'success') setFile(null);
      return next;
    },
    idle,
  );

  return (
    <form
      action={action}
      className="grid gap-4 rounded-[var(--radius-lg)] bg-[var(--color-elevated)] p-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <h3 className="flex items-center gap-2 font-semibold">
        <FiFilePlus aria-hidden="true" className="text-[var(--color-primary)]" />
        Новый документ
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Категория документа" name="category" defaultValue="PASSPORT" required>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
        <Input label="Название документа" name="title" maxLength={120} required />
      </div>
      <DocumentDropzone
        id={`client-document-${clientId}`}
        label="Файл документа"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        hint="JPG, PNG, WebP или PDF до 15 МБ. Формат повторно проверяется на сервере."
        file={file}
        busy={pending}
        error={stateError(state)}
        onFileSelect={setFile}
      />
      <Button type="submit" size="sm" loading={pending} disabled={!file} className="w-fit">
        Загрузить документ
      </Button>
    </form>
  );
}

export function DocumentsPanel({
  clientId,
  clientName,
  documents,
  canManage,
  canArchive,
}: {
  clientId: string;
  clientName: string;
  documents: readonly ClientDocumentListItem[];
  canManage: boolean;
  canArchive: boolean;
}) {
  return (
    <Card data-testid="client-documents-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Файлы и фотография</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Просмотр и скачивание доступны только после успешной антивирусной проверки.
            </p>
          </div>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {documents.length} из 20
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-5">
        {canManage ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <PhotoUploadForm clientId={clientId} clientName={clientName} />
            <NewDocumentForm clientId={clientId} />
          </div>
        ) : null}

        {documents.length === 0 ? (
          <EmptyState
            title="Документы пока не загружены"
            description={
              canManage
                ? 'Выберите категорию, добавьте понятное название и загрузите первый файл.'
                : 'Разрешённые документы появятся здесь после загрузки и проверки.'
            }
          />
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            {documents.map((document) => (
              <DocumentCard
                key={document.id}
                clientId={clientId}
                document={document}
                canManage={canManage}
                canArchive={canArchive}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
