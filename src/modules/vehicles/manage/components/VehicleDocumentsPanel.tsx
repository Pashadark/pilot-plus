'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { FiDownload, FiFileText, FiShield } from 'react-icons/fi';

import { DocumentDropzone } from '@/modules/client-documents/components/DocumentDropzone';
import { useToast } from '@/shared/providers/ToastProvider';
import { Badge, Button, Card, CardContent, CardHeader } from '@/shared/ui';

import { uploadVehicleDocumentAction } from '../document-actions';

type DocumentItem = {
  id: string;
  title: string;
  type: string;
  expiresAt: string | null;
  originalName: string | null;
  hasFile: boolean;
};

const labels: Record<string, string> = {
  STS: 'СТС',
  PTS: 'ПТС',
  OSAGO: 'ОСАГО',
  CASCO: 'КАСКО',
  MAINTENANCE: 'ТО / ремонт',
  REPAIR: 'ТО / ремонт',
  OTHER: 'Другое',
};

export function VehicleDocumentsPanel({
  vehicleId,
  documents,
  compact = false,
}: {
  vehicleId: string;
  documents: DocumentItem[];
  compact?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function submit(formData: FormData) {
    if (!file) return;
    formData.set('vehicleId', vehicleId);
    formData.set('file', file);
    startTransition(async () => {
      const result = await uploadVehicleDocumentAction(formData);
      showToast({ tone: result.ok ? 'success' : 'danger', title: result.message });
      if (result.ok) setFile(null);
    });
  }

  if (compact) {
    const slots = ['STS', 'PTS', 'OSAGO', 'CASCO', 'MAINTENANCE'] as const;

    return (
      <div className="min-w-0">
        <h2 className="text-base font-bold">Документы автомобиля</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--color-border)]">
          {slots.map((type) => {
            const document = documents.find(
              (item) => item.type === type || (type === 'MAINTENANCE' && item.type === 'REPAIR'),
            );
            return (
              <div
                key={type}
                className="grid min-h-11 items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[130px_minmax(0,1fr)_140px_90px]"
              >
                <strong className="font-semibold">{labels[type]}</strong>
                <span className="truncate text-[var(--color-text-secondary)]">
                  {document?.originalName ?? 'Файл не загружен'}
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  {document?.expiresAt
                    ? new Intl.DateTimeFormat('ru-RU').format(new Date(document.expiresAt))
                    : 'Дата не указана'}
                </span>
                {document?.hasFile ? (
                  <Link
                    href={`/vehicles/${vehicleId}/documents/${document.id}/download`}
                    className="inline-flex min-h-9 items-center justify-end gap-1.5 font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    <FiDownload /> Скачать
                  </Link>
                ) : (
                  <Link
                    href={`/vehicles/${vehicleId}?tab=documents`}
                    className="inline-flex min-h-9 items-center justify-end font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    Загрузить
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <form action={submit} className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              name="type"
              aria-label="Тип документа"
              required
              className="min-h-11 rounded-lg border bg-[var(--color-surface)] px-3 text-sm"
            >
              <option value="STS">СТС</option>
              <option value="PTS">ПТС</option>
              <option value="OSAGO">ОСАГО</option>
              <option value="CASCO">КАСКО</option>
              <option value="MAINTENANCE">ТО / ремонт</option>
            </select>
            <input
              name="title"
              aria-label="Название документа"
              className="min-h-11 rounded-lg border bg-[var(--color-surface)] px-3 text-sm"
              placeholder="Название документа"
            />
            <input
              name="expiresAt"
              aria-label="Действует до"
              type="date"
              className="min-h-11 rounded-lg border bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <DocumentDropzone
            id={`vehicle-document-${vehicleId}-overview`}
            label="Перетащите документ сюда или выберите файл"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            hint="PDF, JPG, PNG или WebP до 15 МБ"
            file={file}
            busy={pending}
            onFileSelect={setFile}
          />
          {file ? (
            <Button type="submit" disabled={pending}>
              Загрузить документ
            </Button>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Документы автомобиля</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                СТС, ПТС, полисы и документы по обслуживанию.
              </p>
            </div>
            <Badge tone="primary">{documents.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {documents.length ? (
            documents.map((document) => (
              <article
                key={document.id}
                className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] border p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <FiFileText aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{document.title}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">
                    {labels[document.type] ?? document.type}
                    {document.expiresAt
                      ? ` · до ${new Intl.DateTimeFormat('ru-RU').format(new Date(document.expiresAt))}`
                      : ''}
                  </p>
                </div>
                {document.hasFile ? (
                  <Link
                    href={`/vehicles/${vehicleId}/documents/${document.id}/download`}
                    aria-label={`Скачать ${document.title}`}
                    className="grid min-h-11 min-w-11 place-items-center rounded-lg border hover:bg-[var(--color-elevated)]"
                  >
                    <FiDownload aria-hidden="true" />
                  </Link>
                ) : (
                  <Badge tone="warning">Без файла</Badge>
                )}
              </article>
            ))
          ) : (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-4 text-sm text-[var(--color-text-secondary)]">
              Документов пока нет. Добавьте первый файл справа.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FiShield aria-hidden="true" className="text-[var(--color-success)]" />
            <h2 className="font-bold">Добавить документ</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form action={submit} className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Тип
              <select
                name="type"
                required
                className="min-h-11 rounded-lg border bg-[var(--color-surface)] px-3"
              >
                <option value="STS">СТС</option>
                <option value="PTS">ПТС</option>
                <option value="OSAGO">ОСАГО</option>
                <option value="CASCO">КАСКО</option>
                <option value="MAINTENANCE">ТО / ремонт</option>
                <option value="OTHER">Другое</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Название
              <input
                name="title"
                className="min-h-11 rounded-lg border bg-[var(--color-surface)] px-3"
                placeholder="Например, ОСАГО 2026"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Действует до
              <input
                name="expiresAt"
                type="date"
                className="min-h-11 rounded-lg border bg-[var(--color-surface)] px-3"
              />
            </label>
            <DocumentDropzone
              id={`vehicle-document-${vehicleId}${compact ? '-edit' : ''}`}
              label="Перетащите документ"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              hint="PDF, JPG, PNG или WebP до 15 МБ. Файл проходит антивирусную проверку."
              file={file}
              busy={pending}
              onFileSelect={setFile}
            />
            <Button type="submit" disabled={!file || pending}>
              Загрузить документ
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
