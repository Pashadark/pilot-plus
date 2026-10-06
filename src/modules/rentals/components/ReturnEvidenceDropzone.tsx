'use client';

import { useId, useState, type ChangeEvent } from 'react';

type Illustration = 'dashboard' | 'front' | 'right' | 'rear' | 'left' | 'video';

function UploadArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  );
}

function EvidenceIllustration({ kind }: { kind: Illustration }) {
  if (kind === 'dashboard') {
    return (
      <svg aria-hidden="true" viewBox="0 0 132 58" className="h-14 w-32 fill-none stroke-current" strokeWidth="2">
        <path d="M12 45c-4-12-2-25 7-33 11-9 83-9 94 0 9 8 11 21 7 33-12 7-96 7-108 0Z" />
        <circle cx="38" cy="31" r="15" /><circle cx="94" cy="31" r="15" />
        <path d="M38 31l7-7m49 7l-5-9M58 17h16v24H58z" />
      </svg>
    );
  }
  if (kind === 'video') {
    return (
      <svg aria-hidden="true" viewBox="0 0 72 52" className="h-12 w-16 fill-none stroke-current" strokeWidth="2">
        <rect x="5" y="10" width="42" height="32" rx="5" /><path d="m47 20 18-8v28l-18-8Z" />
      </svg>
    );
  }
  if (kind === 'front' || kind === 'rear') {
    return (
      <svg aria-hidden="true" viewBox="0 0 112 64" className="h-14 w-24 fill-none stroke-current" strokeWidth="2">
        <path d={kind === 'front' ? 'M22 25 31 9h50l9 16 8 8v19H14V33l8-8Z' : 'M22 24 31 9h50l9 15 8 9v19H14V33l8-9Z'} />
        <path d="M27 25h58M21 38h18m34 0h18M34 12l-6 13m50-13 6 13" />
        {kind === 'front' ? <path d="M42 39h28l-4 8H46Z" /> : <path d="M39 35h34v11H39z" />}
        <circle cx="27" cy="51" r="4" /><circle cx="85" cy="51" r="4" />
      </svg>
    );
  }
  const mirror = kind === 'left' ? '-1 0 0 1 112 0' : undefined;
  return (
    <svg aria-hidden="true" viewBox="0 0 112 64" className="h-14 w-24 fill-none stroke-current" strokeWidth="2">
      <g transform={mirror}>
        <path d="M9 43 15 29l18-5 13-13h33l16 14 9 4v16H9Z" />
        <path d="M36 24h48L76 14H48L36 24Zm8 0v19m41-19-7 19" />
        <circle cx="30" cy="45" r="9" /><circle cx="87" cy="45" r="9" />
      </g>
    </svg>
  );
}

export function ReturnEvidenceDropzone({
  name,
  label,
  illustration,
  accept,
  hint = 'Добавить фото',
  wide = false,
  disabled = false,
}: {
  name: string;
  label: string;
  illustration: Illustration;
  accept: string;
  hint?: string;
  wide?: boolean;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFileName(event.currentTarget.files?.[0]?.name ?? null);
  };

  return (
    <label
      htmlFor={inputId}
      className={`group relative grid min-h-36 cursor-pointer overflow-hidden rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--color-primary)_48%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary-soft)_45%,var(--color-surface))] p-4 text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-within:ring-2 focus-within:ring-[var(--color-primary)] ${wide ? 'sm:col-span-2' : ''}`}
    >
      <input
        id={inputId}
        aria-label={label}
        name={name}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span className="text-sm font-bold text-[var(--color-text)]">{label}</span>
      <span className="mt-2 flex min-w-0 items-center justify-between gap-3">
        <EvidenceIllustration kind={illustration} />
        <span className="grid min-w-0 justify-items-center gap-1.5 text-center text-xs font-semibold">
          <span className="grid size-10 place-items-center rounded-full bg-[var(--color-primary-soft)]">
            <UploadArrow />
          </span>
          <span className="max-w-32 truncate text-[var(--color-text-secondary)]">
            {fileName ?? hint}
          </span>
        </span>
      </span>
    </label>
  );
}
