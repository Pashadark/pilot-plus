'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FiBell } from 'react-icons/fi';

import { Badge, IconButton } from '@/shared/ui';

import type { NotificationTone, PilotNotification } from './types';

const toneLabels: Record<NotificationTone, string> = {
  success: 'Успешно',
  warning: 'Внимание',
  danger: 'Важно',
  info: 'Информация',
};

export function NotificationCenter({ notifications }: { notifications: PilotNotification[] }) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((notification) => !readIds.has(notification.id)).length;
  const triggerLabel =
    unreadCount > 0 ? `Уведомления: ${unreadCount} непрочитанных` : 'Уведомления: новых нет';

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <IconButton
          label={triggerLabel}
          variant="ghost"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <FiBell aria-hidden="true" className="size-5" />
        </IconButton>
        {unreadCount > 0 && (
          <Badge
            data-testid="notification-count"
            tone="danger"
            className="pointer-events-none absolute -top-1 -right-1 min-h-5 min-w-5 justify-center px-1 text-[10px]"
          >
            {unreadCount}
          </Badge>
        )}
      </div>

      {open && (
        <section
          role="dialog"
          aria-label="Уведомления"
          className="fixed top-[calc(var(--header-height)+0.5rem)] right-4 z-50 max-h-[calc(100dvh-var(--header-height)-1.5rem)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-[var(--radius-panel)] border bg-[var(--color-surface)] shadow-[var(--shadow-floating)]"
        >
          <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2">
            <h2 className="font-semibold">Уведомления</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => setReadIds(new Set(notifications.map(({ id }) => id)))}
                className="min-h-11 rounded-[var(--radius-sm)] px-2 text-sm font-medium text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                Отметить всё прочитанным
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
              Новых уведомлений нет.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={notification.href}
                    onClick={() => {
                      setReadIds((current) => new Set(current).add(notification.id));
                      setOpen(false);
                    }}
                    className="flex min-h-11 gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)]"
                  >
                    <Badge tone={notification.tone} className="h-fit shrink-0">
                      {toneLabels[notification.tone]}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">{notification.title}</strong>
                      <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
                        {notification.description}
                      </span>
                      <time className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                        {notification.createdAt}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
