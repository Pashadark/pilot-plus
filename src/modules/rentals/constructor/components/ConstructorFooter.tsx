'use client';

import { FiArrowLeft, FiArrowRight, FiFileText } from 'react-icons/fi';

import { constructorSections } from '../domain/flow';
import type { RentalConstructorSectionId } from '../domain/types';

export function ConstructorFooter({
  active,
  onSelect,
  onPreview,
}: {
  active: RentalConstructorSectionId;
  onSelect(id: RentalConstructorSectionId): void;
  onPreview(): void;
}) {
  const index = constructorSections.findIndex((section) => section.id === active);
  const previous = constructorSections[index - 1];
  const next = constructorSections[index + 1];

  return (
    <footer className="sticky bottom-3 z-20 flex min-h-14 items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] p-2 shadow-[var(--shadow-floating)] backdrop-blur-xl">
      <button
        type="button"
        disabled={!previous}
        onClick={() => previous && onSelect(previous.id)}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35"
      >
        <FiArrowLeft aria-hidden />
        <span className="hidden sm:inline">Назад</span>
      </button>
      <button
        type="button"
        aria-label="Открыть предпросмотр"
        onClick={onPreview}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] px-4 text-sm font-semibold text-[var(--color-primary)] xl:hidden"
      >
        <FiFileText aria-hidden />
        Предпросмотр
      </button>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onSelect(next.id)}
        className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        <span>{next ? 'Далее' : 'Готово'}</span>
        <FiArrowRight aria-hidden />
      </button>
    </footer>
  );
}
