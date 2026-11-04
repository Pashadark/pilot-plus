'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FiBell } from 'react-icons/fi';

import { useToast } from '@/shared/providers/ToastProvider';
import { AnchoredPopover } from '@/shared/ui';
import { groupNotifications } from './group-notifications';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  loadNotificationPageAction,
  markEntireInboxReadAction,
} from './server/actions';
import type { NotificationMeta } from './pagination';
import type { NotificationCategory, NotificationTone, PilotNotification } from './types';

type CategoryFilter = 'ALL' | NotificationCategory;

const filters: readonly { value: CategoryFilter; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'RENTAL', label: 'Аренды' },
  { value: 'FINE', label: 'Штрафы' },
  { value: 'CLIENT', label: 'Клиенты' },
  { value: 'FLEET', label: 'Автопарк' },
];

const categoryLabels: Record<NotificationCategory, string> = {
  RENTAL: 'Аренда',
  FINE: 'Штраф',
  CLIENT: 'Клиент',
  FLEET: 'Автопарк',
  SYSTEM: 'Система',
};

const toneDots: Record<NotificationTone, string> = {
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-primary)]',
};

export function NotificationCenter({
  notifications,
  globalScope = false,
  notificationMeta,
}: {
  notifications: readonly PilotNotification[];
  globalScope?: boolean;
  notificationMeta?: NotificationMeta;
}) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [extra, setExtra] = useState<PilotNotification[]>([]);
  const [nextCursor, setNextCursor] = useState(notificationMeta?.nextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [allRead, setAllRead] = useState(false);
  const allNotifications = useMemo(
    () => [...new Map([...notifications, ...extra].map((item) => [item.id, item])).values()],
    [notifications, extra],
  );
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(notifications.filter(({ isRead }) => isRead).map(({ id }) => id)),
  );
  const effectiveReadIds = new Set([
    ...readIds,
    ...allNotifications.filter((item) => item.isRead || allRead).map((item) => item.id),
  ]);
  const localUnreadCount = allNotifications.filter(
    (notification) => !effectiveReadIds.has(notification.id),
  ).length;
  const unreadCount = allRead
    ? 0
    : notificationMeta
      ? Math.max(
          0,
          notificationMeta.unreadCount -
            allNotifications.filter((item) => !item.isRead && readIds.has(item.id)).length,
        )
      : localUnreadCount;
  const triggerLabel =
    unreadCount > 0 ? `Уведомления: ${unreadCount} непрочитанных` : 'Уведомления: новых нет';
  const visibleNotifications = useMemo(
    () =>
      filter === 'ALL'
        ? allNotifications
        : allNotifications.filter(({ category }) => category === filter),
    [filter, allNotifications],
  );
  const notificationGroups = useMemo(
    () => groupNotifications([...visibleNotifications]),
    [visibleNotifications],
  );
  const visibleGroups = notificationGroups.slice(0, visibleLimit);

  const markAllRead = async () => {
    if (marking) return;
    setMarking(true);
    const previous = new Set(readIds);
    try {
      const result = notificationMeta
        ? await markEntireInboxReadAction()
        : await markAllNotificationsReadAction(allNotifications.map(({ id }) => id));
      if (result.status === 'error') {
        setReadIds(previous);
        showToast({ tone: 'danger', title: result.message });
        return;
      }
      setReadIds(new Set(allNotifications.map(({ id }) => id)));
      setAllRead(true);
      showToast({ tone: 'success', title: 'Все уведомления прочитаны.' });
    } catch {
      showToast({ tone: 'danger', title: 'Не удалось отметить уведомления. Попробуйте снова.' });
    } finally {
      setMarking(false);
    }
  };

  const loadMore = async () => {
    if (loading || !nextCursor) return;
    setLoading(true);
    try {
      const page = await loadNotificationPageAction(nextCursor);
      setExtra((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setVisibleLimit((current) => current + 20);
    } catch {
      showToast({ tone: 'danger', title: 'Не удалось загрузить уведомления. Повторите попытку.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnchoredPopover
      ariaLabel={triggerLabel}
      panelAriaLabel="Уведомления"
      mobileTitle="Уведомления"
      panelClassName="w-[min(27rem,calc(100vw-1rem))] sm:w-[27rem]"
      trigger={
        <span className="relative grid size-11 place-items-center rounded-[var(--radius-md)] transition-colors hover:bg-[var(--color-primary-soft)]">
          <FiBell aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <span
              data-testid="notification-count"
              className="pointer-events-none absolute top-0.5 right-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] leading-none font-bold text-white ring-2 ring-[var(--color-surface)]"
            >
              {unreadCount}
            </span>
          ) : null}
        </span>
      }
    >
      <div className="sticky top-0 z-10 border-b bg-[var(--color-surface)]">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
          <div>
            <h2 className="font-semibold">Уведомления</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {globalScope ? 'Все компании и сотрудники' : 'События вашей компании'}
            </p>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={marking}
              className="min-h-10 rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              {marking ? 'Отмечаем…' : 'Прочитать все'}
            </button>
          ) : null}
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Фильтр уведомлений">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className="min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors aria-pressed:border-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)] aria-pressed:text-[var(--color-primary)]"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {notificationGroups.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]">
          {notifications.length === 0 ? 'Новых уведомлений нет.' : 'В этой категории событий нет.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-border)]">
            {visibleGroups.map((group) => {
              const notification = group.representative;
              const unread = group.notificationIds.some((id) => !effectiveReadIds.has(id));
              return (
                <li key={group.key} className="relative">
                  {unread ? (
                    <span className="absolute inset-y-3 left-0 w-0.5 rounded-r bg-[var(--color-primary)]" />
                  ) : null}
                  <Link
                    href={notification.href}
                    onClick={() => {
                      setReadIds((current) => {
                        const next = new Set(current);
                        group.notificationIds.forEach((id) => next.add(id));
                        return next;
                      });
                      void Promise.all(
                        group.notificationIds.map((id) => markNotificationReadAction(id)),
                      ).then((results) => {
                        const failed = results.find((result) => result.status === 'error');
                        if (failed) {
                          setReadIds((current) => {
                            const next = new Set(current);
                            group.notificationIds.forEach((id) => next.delete(id));
                            return next;
                          });
                          showToast({ tone: 'danger', title: failed.message });
                        }
                      });
                    }}
                    className="flex min-h-11 gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)]"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${toneDots[notification.tone]}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <strong className="block text-sm leading-5">{notification.title}</strong>
                        <time className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                          {notification.createdAt}
                        </time>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--color-text-secondary)]">
                        {notification.description}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
                        <span className="font-semibold text-[var(--color-primary)]">
                          {categoryLabels[notification.category]}
                        </span>
                        {notification.actorLabel || notification.companyLabel ? (
                          <span>
                            {[notification.actorLabel, notification.companyLabel]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ) : null}
                        {group.count > 1 ? (
                          <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 font-semibold text-[var(--color-primary)]">
                            {group.count} событий
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {notificationGroups.length > visibleLimit ? (
            <div className="border-t border-[var(--color-border)] p-3">
              <button
                type="button"
                onClick={() => setVisibleLimit((current) => current + 10)}
                className="min-h-10 w-full rounded-[var(--radius-sm)] text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                Показать ещё
              </button>
            </div>
          ) : null}
        </>
      )}
      {nextCursor && notificationGroups.length <= visibleLimit ? (
        <div className="border-t border-[var(--color-border)] p-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadMore()}
            className="min-h-11 w-full rounded-[var(--radius-sm)] text-sm font-semibold text-[var(--color-primary)] disabled:opacity-50"
          >
            {loading ? 'Загрузка…' : 'Показать ещё'}
          </button>
        </div>
      ) : null}
    </AnchoredPopover>
  );
}
