'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiCheck, FiImage, FiX } from 'react-icons/fi';
import { Button } from '@/shared/ui';
import { uploadProfileBannerAction } from './upload-banner';
import type { AvatarActionState } from './upload-avatar';

const initialState: AvatarActionState = { status: 'idle' };

export function BannerEditor() {
  const [selected, setSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const submit = useCallback(
    async (previous: AvatarActionState, formData: FormData) => {
      const next = await uploadProfileBannerAction(previous, formData);
      if (next.status === 'success') {
        setSelected(false);
        if (inputRef.current) inputRef.current.value = '';
        router.refresh();
      }
      return next;
    },
    [router],
  );
  const [state, formAction, pending] = useActionState(submit, initialState);

  return (
    <form action={formAction} className="absolute top-3 right-3 z-20">
      <input
        ref={inputRef}
        type="file"
        name="banner"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="Выбрать фон профиля"
        onChange={(event) => setSelected(Boolean(event.target.files?.[0]))}
      />
      {!selected ? (
        <button
          type="button"
          aria-label="Изменить фон профиля"
          onClick={() => inputRef.current?.click()}
          className="grid size-10 place-items-center rounded-full border border-white/70 bg-slate-950/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-950/75"
        >
          <FiImage aria-hidden />
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border bg-[var(--color-surface)] p-2 shadow-lg">
          <Button type="submit" size="sm" loading={pending}>
            <FiCheck /> {pending ? 'Сохраняем…' : 'Сохранить фон'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Отменить выбор фона"
            onClick={() => {
              setSelected(false);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            <FiX />
          </Button>
        </div>
      )}
      {state.status === 'error' ? (
        <p role="alert" className="mt-2 w-64 rounded-lg bg-[var(--color-danger-soft)] p-2 text-xs text-[var(--color-danger)] shadow-lg">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
