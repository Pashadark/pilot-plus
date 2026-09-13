'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import {
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDownload,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiLink,
  FiMoreVertical,
  FiShield,
  FiTruck,
  FiUser,
} from 'react-icons/fi';

import { useToast } from '@/shared/providers/ToastProvider';

type DocumentLink = {
  format: 'PDF' | 'DOCX';
  version: number;
};

export type RentalRowActionsMenuProps = {
  rentalId: string;
  clientId: string;
  vehicleId: string;
  contractNumber: string | null;
  documents: readonly DocumentLink[];
};

const itemClass =
  'flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-elevated)] focus-visible:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:text-[var(--color-text-tertiary)] disabled:hover:bg-transparent';

function latestDocument(documents: readonly DocumentLink[], format: DocumentLink['format']) {
  return documents
    .filter((document) => document.format === format)
    .sort((left, right) => right.version - left.version)[0];
}

export function RentalRowActionsMenu({
  rentalId,
  clientId,
  vehicleId,
  contractNumber,
  documents,
}: RentalRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const label = contractNumber ?? 'договора';
  const pdf = latestDocument(documents, 'PDF');
  const docx = latestDocument(documents, 'DOCX');

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuRect = menuRef.current?.getBoundingClientRect();
    const width = Math.min(menuRect?.width || 304, window.innerWidth - 24);
    const minimumUsableHeight = Math.min(240, window.innerHeight - 24);
    const maximumTop = Math.max(12, window.innerHeight - minimumUsableHeight - 12);
    const top = Math.max(12, Math.min(rect.top, maximumTop));
    setPosition({
      top,
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      maxHeight: Math.max(0, window.innerHeight - top - 12),
    });
  }

  function close({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)');
    firstItem?.focus();
    let frameId: number | null = null;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close({ restoreFocus: true });
      }
    };
    const onViewportChange = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  async function copy(value: string, successTitle: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ tone: 'success', title: successTitle });
      close({ restoreFocus: true });
    } catch {
      showToast({
        tone: 'danger',
        title: 'Не удалось скопировать.',
        description: 'Разрешите доступ к буферу обмена и повторите попытку.',
      });
    }
  }

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Действия ${label}`}
      className="fixed z-[120] grid w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
      style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
      onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
        );
        if (!items.length) return;
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : event.key === 'ArrowDown'
                ? (current + 1) % items.length
                : (current - 1 + items.length) % items.length;
        items[next]?.focus();
      }}
    >
      <Link role="menuitem" href={`/rentals/${rentalId}`} className={itemClass} onClick={() => close()}>
        <FiExternalLink aria-hidden className="shrink-0 text-[var(--color-primary)]" />
        Открыть договор
      </Link>
      <Link role="menuitem" href={`/rentals/${rentalId}/edit`} className={itemClass} onClick={() => close()}>
        <FiEdit3 aria-hidden className="shrink-0 text-[var(--color-primary)]" />
        Редактировать условия
      </Link>
      <Link
        role="menuitem"
        href={`/rentals/${rentalId}?settlement=rent#rental-settlement`}
        className={itemClass}
        onClick={() => close()}
      >
        <FiCreditCard aria-hidden className="shrink-0 text-[var(--color-primary)]" />
        Внести или исправить оплату
      </Link>
      <Link
        role="menuitem"
        href={`/rentals/${rentalId}?settlement=deposit#rental-settlement`}
        className={itemClass}
        onClick={() => close()}
      >
        <FiShield aria-hidden className="shrink-0 text-[var(--color-primary)]" />
        Управление залогом
      </Link>

      <div role="separator" className="my-1 border-t border-[var(--color-border)]" />

      <Link role="menuitem" href={`/clients/${clientId}`} className={itemClass} onClick={() => close()}>
        <FiUser aria-hidden className="shrink-0 text-[var(--color-text-secondary)]" />
        Открыть клиента
      </Link>
      <Link role="menuitem" href={`/vehicles/${vehicleId}`} className={itemClass} onClick={() => close()}>
        <FiTruck aria-hidden className="shrink-0 text-[var(--color-text-secondary)]" />
        Открыть автомобиль
      </Link>
      <Link
        role="menuitem"
        href={`/rentals/${rentalId}#rental-history`}
        className={itemClass}
        onClick={() => close()}
      >
        <FiClock aria-hidden className="shrink-0 text-[var(--color-text-secondary)]" />
        История действий
      </Link>

      <div role="separator" className="my-1 border-t border-[var(--color-border)]" />

      {pdf ? (
        <a
          role="menuitem"
          href={`/rentals/${rentalId}/documents/${pdf.version}/PDF`}
          download
          className={itemClass}
          onClick={() => close()}
        >
          <FiDownload aria-hidden className="shrink-0 text-rose-600" />
          Скачать PDF
        </a>
      ) : (
        <button role="menuitem" type="button" disabled className={itemClass}>
          <FiFileText aria-hidden className="shrink-0" />
          Скачать PDF
        </button>
      )}
      {docx ? (
        <a
          role="menuitem"
          href={`/rentals/${rentalId}/documents/${docx.version}/DOCX`}
          download
          className={itemClass}
          onClick={() => close()}
        >
          <FiDownload aria-hidden className="shrink-0 text-blue-600" />
          Скачать DOCX
        </a>
      ) : (
        <button role="menuitem" type="button" disabled className={itemClass}>
          <FiFileText aria-hidden className="shrink-0" />
          Скачать DOCX
        </button>
      )}

      <div role="separator" className="my-1 border-t border-[var(--color-border)]" />

      <button
        role="menuitem"
        type="button"
        disabled={!contractNumber}
        className={itemClass}
        onClick={() => contractNumber && copy(contractNumber, 'Номер договора скопирован.')}
      >
        <FiCopy aria-hidden className="shrink-0 text-[var(--color-text-secondary)]" />
        Скопировать номер договора
      </button>
      <button
        role="menuitem"
        type="button"
        className={itemClass}
        onClick={() =>
          copy(
            new URL(`/rentals/${rentalId}`, window.location.origin).toString(),
            'Ссылка на договор скопирована.',
          )
        }
      >
        <FiLink aria-hidden className="shrink-0 text-[var(--color-text-secondary)]" />
        Скопировать ссылку
      </button>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Ещё действия ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        onClick={() => {
          if (!open) updatePosition();
          setOpen((value) => !value);
        }}
      >
        <FiMoreVertical aria-hidden />
      </button>
      {typeof document === 'undefined' || !menu ? null : createPortal(menu, document.body)}
    </>
  );
}
