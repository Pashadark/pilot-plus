'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiCheck, FiEdit2, FiX } from 'react-icons/fi';

import { Avatar, Button } from '@/shared/ui';

import { uploadAvatarAction, type AvatarActionState } from './upload-avatar';

const initialState: AvatarActionState = { status: 'idle' };

export function AvatarEditor({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const [state, formAction, pending] = useActionState(uploadAvatarAction, initialState);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== 'success') return;

    const resetTimer = window.setTimeout(() => {
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    }, 0);
    router.refresh();

    return () => window.clearTimeout(resetTimer);
  }, [router, state.status]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function clearSelection() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <form action={formAction} className="relative shrink-0">
      <div className="rounded-full border-4 border-white shadow-sm">
        <Avatar
          name={name}
          src={preview ?? avatarUrl}
          size="lg"
          className="size-20 text-2xl sm:size-24"
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="Выбрать новую аватарку"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (preview) URL.revokeObjectURL(preview);
          setPreview(URL.createObjectURL(file));
        }}
      />
      <button
        type="button"
        aria-label="Изменить аватарку"
        onClick={() => inputRef.current?.click()}
        className="absolute -right-1 -bottom-1 grid size-10 place-items-center rounded-full border-4 border-white bg-[var(--color-surface)] text-[var(--color-primary)] shadow-md transition hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <FiEdit2 />
      </button>
      {preview && (
        <div className="absolute top-full left-1/2 z-20 mt-3 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-lg">
          <Button type="submit" size="sm" loading={pending}>
            <FiCheck /> {pending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            aria-label="Отменить выбор аватарки"
          >
            <FiX />
          </Button>
        </div>
      )}
      {state.status === 'error' && (
        <p
          role="alert"
          className="absolute top-full left-0 z-20 mt-3 w-64 rounded-lg bg-[var(--color-danger-soft)] p-2 text-xs text-[var(--color-danger)] shadow-lg"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
