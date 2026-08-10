'use client';

import { useState, type DragEvent } from 'react';
import { FiUploadCloud } from 'react-icons/fi';

export interface DocumentDropzoneProps {
  id: string;
  label: string;
  accept: string;
  hint?: string;
  file?: File | null;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
  onFileSelect: (file: File | null) => void;
}

export function DocumentDropzone({
  id,
  label,
  accept,
  hint = 'Перетащите файл сюда или выберите его с устройства.',
  file,
  busy = false,
  disabled = false,
  error,
  onFileSelect,
}: DocumentDropzoneProps) {
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const selectedFile = file === undefined ? droppedFile : file;
  const unavailable = busy || disabled;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const selectFile = (nextFile: File | null) => {
    if (file === undefined) setDroppedFile(nextFile);
    onFileSelect(nextFile);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (unavailable) return;
    selectFile(event.dataTransfer.files[0] ?? null);
  };

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div
        data-testid="document-dropzone"
        onDragEnter={(event) => {
          event.preventDefault();
          if (!unavailable) setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={handleDrop}
        className={`grid min-w-0 gap-3 rounded-[var(--radius-md)] border-2 border-dashed p-4 transition-colors duration-[var(--motion-fast)] motion-reduce:transition-none ${dragActive ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border-strong)] bg-[var(--color-elevated)]'}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <FiUploadCloud
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-[var(--color-primary)]"
          />
          <div className="min-w-0">
            <p className="font-medium">{selectedFile?.name ?? 'Файл не выбран'}</p>
            <p id={descriptionId} className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {hint}
            </p>
          </div>
        </div>
        <input
          id={id}
          name="file"
          type="file"
          accept={accept}
          disabled={unavailable}
          aria-invalid={Boolean(error)}
          aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
          onChange={(event) => selectFile(event.currentTarget.files?.item(0) ?? null)}
          className="min-h-11 w-full min-w-0 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-primary-soft)] file:px-3 file:py-2 file:font-semibold file:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-55"
        />
      </div>
      {busy ? (
        <div className="grid gap-1" aria-live="polite">
          <span className="text-sm font-medium">Загрузка и проверка файла</span>
          <progress
            aria-label="Загрузка и проверка файла"
            className="h-2 w-full overflow-hidden rounded-full accent-[var(--color-primary)]"
          />
        </div>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
