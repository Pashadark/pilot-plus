'use client';

import { FiCheck, FiFile, FiLoader } from 'react-icons/fi';

type SelectedEvidence = { name: string; size: number } | null;

function fileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} КБ`;
  return `${Math.round(size / (1024 * 1024))} МБ`;
}

function EvidenceFile({ file, label }: { file: SelectedEvidence; label: string }) {
  if (!file) return null;
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2.5">
      <FiFile aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[var(--color-text-secondary)]">{label}</span>
        <span className="block truncate text-sm font-semibold">{file.name}</span>
      </span>
      <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
        {fileSize(file.size)}
      </span>
    </li>
  );
}

export function RentalOperationProgress({
  pending,
  video,
  photo,
}: {
  pending: boolean;
  video: SelectedEvidence;
  photo: SelectedEvidence;
}) {
  if (!video && !photo && !pending) return null;

  return (
    <section
      aria-label="Загрузка материалов возврата"
      className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <ul className="grid gap-2">
        <EvidenceFile file={video} label="Видео осмотра" />
        <EvidenceFile file={photo} label="Фото приборной панели" />
      </ul>

      {pending ? (
        <div role="status" aria-live="assertive" className="grid gap-3">
          <div
            role="progressbar"
            aria-label="Загрузка и обработка материалов"
            aria-valuetext="Загрузка и обработка выполняются"
            className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]"
          >
            <span className="block h-full w-2/3 animate-pulse rounded-full bg-[var(--color-primary)]" />
          </div>
          <ol className="grid gap-2 text-sm">
            <li className="flex items-center gap-2 font-semibold text-[var(--color-primary)]">
              <FiLoader aria-hidden="true" className="animate-spin" />
              Загружаем файлы
            </li>
            <li className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <FiCheck aria-hidden="true" />
              Закрываем аренду
            </li>
          </ol>
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Не закрывайте страницу до завершения загрузки.
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Файлы выбраны и будут загружены после подтверждения операции.
        </p>
      )}
    </section>
  );
}
