'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import {
  FiArrowLeft,
  FiArrowRight,
  FiImage,
  FiStar,
  FiTrash2,
  FiUploadCloud,
} from 'react-icons/fi';

import { useToast } from '@/shared/providers/ToastProvider';
import { Button } from '@/shared/ui';

import {
  deleteVehicleImageAction,
  moveVehicleImageAction,
  setPrimaryVehicleImageAction,
  uploadVehicleImageAction,
} from '../image-actions';

type GalleryImage = { id: string; localPath: string; alt: string; isPrimary: boolean };

export function VehicleGallery({
  vehicleId,
  images,
}: {
  vehicleId: string;
  images: GalleryImage[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function notify(result: { ok: boolean; message: string }) {
    showToast({ tone: result.ok ? 'success' : 'danger', title: result.message });
  }

  function submitFiles(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    form.set('vehicleId', vehicleId);
    Array.from(files).forEach((file) => form.append('files', file));
    startTransition(async () => notify(await uploadVehicleImageAction(form)));
  }

  function mutate(
    action: (form: FormData) => Promise<{ ok: boolean; message: string }>,
    imageId: string,
    extra?: [string, string],
  ) {
    const form = new FormData();
    form.set('vehicleId', vehicleId);
    form.set('imageId', imageId);
    if (extra) form.set(extra[0], extra[1]);
    startTransition(async () => notify(await action(form)));
  }

  return (
    <section className="grid gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Фотографии автомобиля</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            До 12 фотографий. JPG, PNG или WebP, до 15 МБ.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <FiUploadCloud aria-hidden="true" /> Добавить фото
        </Button>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        aria-label="Добавить фотографии автомобиля"
        type="file"
        name="files"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(event) => submitFiles(event.target.files)}
      />
      <button
        type="button"
        className={`grid min-h-28 place-items-center rounded-[var(--radius-md)] border border-dashed p-5 text-center transition-colors ${dragging ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border-strong)] bg-[var(--color-elevated)]'}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          submitFiles(event.dataTransfer.files);
        }}
      >
        <span className="grid gap-1">
          <FiImage aria-hidden="true" className="mx-auto size-6 text-[var(--color-primary)]" />
          <span className="font-semibold">Перетащите фотографии сюда</span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            или нажмите, чтобы выбрать файлы
          </span>
        </span>
      </button>
      {images.length === 0 ? (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] p-5 text-sm text-[var(--color-text-secondary)]">
          Фотографий пока нет. В карточке автомобиля будет показана фирменная SVG-заглушка.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <article
              key={image.id}
              className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
            >
              <div className="relative aspect-[16/10] bg-[var(--color-elevated)]">
                <Image
                  src={image.localPath}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
                {image.isPrimary && (
                  <span className="absolute top-2 left-2 rounded-full bg-[var(--color-primary)] px-2.5 py-1 text-xs font-bold text-white">
                    Основное фото
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 p-2">
                {!image.isPrimary && (
                  <button
                    type="button"
                    className="min-h-11 rounded-md px-3 text-sm font-semibold hover:bg-[var(--color-primary-soft)]"
                    onClick={() => mutate(setPrimaryVehicleImageAction, image.id)}
                  >
                    <FiStar className="inline" /> Основное
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Переместить фото ${image.alt} влево`}
                  disabled={index === 0 || pending}
                  className="min-h-11 min-w-11 rounded-md hover:bg-[var(--color-elevated)] disabled:opacity-40"
                  onClick={() => mutate(moveVehicleImageAction, image.id, ['direction', 'up'])}
                >
                  <FiArrowLeft className="mx-auto" />
                </button>
                <button
                  type="button"
                  aria-label={`Переместить фото ${image.alt} вправо`}
                  disabled={index === images.length - 1 || pending}
                  className="min-h-11 min-w-11 rounded-md hover:bg-[var(--color-elevated)] disabled:opacity-40"
                  onClick={() => mutate(moveVehicleImageAction, image.id, ['direction', 'down'])}
                >
                  <FiArrowRight className="mx-auto" />
                </button>
                <button
                  type="button"
                  aria-label={`Удалить фото ${image.alt}`}
                  disabled={pending}
                  className="ml-auto min-h-11 min-w-11 rounded-md text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                  onClick={() => mutate(deleteVehicleImageAction, image.id)}
                >
                  <FiTrash2 className="mx-auto" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
