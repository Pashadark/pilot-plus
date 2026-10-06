'use client';

import { useState } from 'react';

import { DocumentDropzone } from '@/modules/client-documents/components/DocumentDropzone';
import type { ClientOcrDocumentKind, ClientOcrFields } from '@/modules/clients/document-ocr';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Overlays';

export type ClientAutofillFiles = {
  passportMain: File;
  passportRegistration: File;
  driverLicense: File;
};

type FileKey = keyof ClientAutofillFiles;

const documents: readonly {
  key: FileKey;
  kind: ClientOcrDocumentKind;
  label: string;
}[] = [
  { key: 'passportMain', kind: 'PASSPORT_MAIN', label: 'Основной разворот паспорта' },
  {
    key: 'passportRegistration',
    kind: 'PASSPORT_REGISTRATION',
    label: 'Страница с регистрацией',
  },
  { key: 'driverLicense', kind: 'DRIVER_LICENSE', label: 'Водительское удостоверение' },
];

type SelectedFiles = Partial<ClientAutofillFiles>;

export function ClientDocumentAutofillDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onApply(fields: Record<string, string>, files: ClientAutofillFiles): void;
}) {
  const [files, setFiles] = useState<SelectedFiles>({});
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FileKey, string>>>({});
  const ready = documents.every(({ key }) => files[key]);

  const recognize = async () => {
    if (!ready) return;
    setBusy(true);
    setErrors({});
    const nextErrors: Partial<Record<FileKey, string>> = {};
    const results = await Promise.allSettled(
      documents.map(async ({ key, kind, label }) => {
        const payload = new FormData();
        payload.set('documentKind', kind);
        payload.set('file', files[key] as File);
        const response = await fetch('/clients/document-ocr', { method: 'POST', body: payload });
        const result = (await response.json()) as { fields?: ClientOcrFields; error?: string };
        if (!response.ok || !result.fields) {
          throw new Error(result.error || `Не удалось распознать «${label}».`);
        }
        return { key, fields: result.fields };
      }),
    );
    const merged: Record<string, string> = {};
    results.forEach((result, index) => {
      const document = documents[index];
      if (!document) return;
      if (result.status === 'rejected') {
        nextErrors[document.key] =
          result.reason instanceof Error ? result.reason.message : 'Не удалось распознать файл.';
        return;
      }
      for (const [name, value] of Object.entries(result.value.fields)) {
        if (value) merged[name] = value;
      }
    });
    setErrors(nextErrors);
    setBusy(false);
    onApply(merged, files as ClientAutofillFiles);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={busy ? () => undefined : onOpenChange}
      title="Автозаполнение по документам"
      description="Загрузите три фотографии. Мы заполним только уверенно распознанные поля — перед сохранением их можно исправить."
      className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={recognize} disabled={!ready} loading={busy}>
            {busy ? 'Распознаём документы…' : 'Распознать и заполнить'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {documents.map(({ key, label }) => (
          <DocumentDropzone
            key={key}
            id={`client-autofill-${key}`}
            label={label}
            accept=".jpg,.jpeg,.png,.webp"
            hint="JPG, PNG или WebP до 15 МБ"
            file={files[key] ?? null}
            busy={busy}
            error={errors[key]}
            onFileSelect={(file) => {
              setFiles((current) => ({ ...current, [key]: file ?? undefined }));
              setErrors((current) => ({ ...current, [key]: undefined }));
            }}
          />
        ))}
      </div>
    </Modal>
  );
}
