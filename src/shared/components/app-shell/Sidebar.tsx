'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiActivity, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import { Avatar } from '@/shared/ui';
import { IconButton } from '@/shared/ui/IconButton';

import { navigation } from './navigation';

interface SidebarProps {
  expanded?: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
  systemHealthSummary: SystemHealthSummary;
  user: SafeUser;
}

const healthPresentation: Record<SystemHealthSummary['state'], { label: string; color: string }> = {
  healthy: { label: 'Все сервисы работают', color: 'bg-[var(--color-success)]' },
  degraded: { label: 'Требуется внимание', color: 'bg-[var(--color-warning)]' },
  unavailable: { label: 'Сервисы недоступны', color: 'bg-[var(--color-danger)]' },
};

export function Sidebar({
  expanded = true,
  onNavigate,
  onToggle,
  systemHealthSummary,
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const visibleNavigation = navigation.filter(
    (item) =>
      (item.href !== '/system' || user.role === 'SUPER_ADMIN') &&
      (!item.adminOnly || user.canAccessAdmin) &&
      (!item.requiredCapability || user.capabilities?.includes(item.requiredCapability)),
  );
  const navigationGroups = [
    {
      label: 'Работа',
      items: visibleNavigation.filter((item) =>
        ['/', '/map', '/vehicles', '/clients', '/leads', '/rentals'].includes(item.href),
      ),
    },
    {
      label: 'Операции',
      items: visibleNavigation.filter((item) =>
        ['/fines', '/maintenance', '/wash', '/devices', '/events'].includes(item.href),
      ),
    },
    {
      label: 'Система',
      items: visibleNavigation.filter((item) => ['/admin', '/ui-kit'].includes(item.href)),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-20 shrink-0 items-center overflow-hidden border-b px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)] text-base font-black text-white">
            СП
          </span>
          <div
            className={`overflow-hidden whitespace-nowrap transition-all ${expanded ? 'w-32 opacity-100' : 'w-0 opacity-0'}`}
          >
            <p className="text-lg leading-5 font-black tracking-tight">СУПА ПРО</p>
            <p className="mt-1 text-[8px] leading-tight tracking-[0.08em] text-[var(--color-text-secondary)] uppercase">
              Управление автопарком
            </p>
          </div>
        </div>
      </div>
      <nav aria-label="Основная навигация" className="flex-1 overflow-y-auto px-3 py-3">
        {navigationGroups.map((group) => (
          <section key={group.label} className="sidebar-navigation-group">
            <p
              data-navigation-label="true"
              className={`sidebar-navigation-group-label overflow-hidden px-3 text-[10px] font-semibold tracking-[0.12em] text-[var(--color-text-muted)] uppercase transition-[height,opacity,padding] duration-200 ${expanded ? 'h-5 pb-1 opacity-100' : 'h-0 p-0 opacity-0'}`}
            >
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isCurrent = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isCurrent ? 'page' : undefined}
                    aria-label={item.label}
                    onClick={onNavigate}
                    className={`relative flex min-h-11 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-colors duration-[var(--motion-fast)] ${
                      isCurrent
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'text-[var(--color-navigation-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    <span
                      data-navigation-label="true"
                      className={`transition-[width,opacity] duration-200 ${
                        expanded
                          ? 'min-w-0 flex-1 py-2 leading-snug whitespace-normal opacity-100'
                          : 'w-0 overflow-hidden whitespace-nowrap opacity-0'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
      <div className="border-t p-3">
        {user.role === 'SUPER_ADMIN' && (
          <Link
            href="/system"
            aria-current={pathname === '/system' ? 'page' : undefined}
            aria-label={`Состояние системы: ${healthPresentation[systemHealthSummary.state].label}, ${systemHealthSummary.count} из ${systemHealthSummary.total}`}
            onClick={onNavigate}
            className="mb-1 flex min-h-12 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] px-2 transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-elevated)] text-[var(--color-navigation-muted)]">
              <FiActivity aria-hidden="true" />
              <span
                aria-hidden="true"
                className={`absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-[var(--color-navigation)] ${healthPresentation[systemHealthSummary.state].color}`}
              />
            </span>
            <div
              className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-all ${expanded ? 'w-28 opacity-100' : 'w-0 opacity-0'}`}
            >
              <p className="truncate text-xs font-semibold">Состояние системы</p>
              <p className="truncate text-[10px] text-[var(--color-text-secondary)]">
                {healthPresentation[systemHealthSummary.state].label} · {systemHealthSummary.count}/
                {systemHealthSummary.total}
              </p>
            </div>
          </Link>
        )}
        <Link
          href="/profile"
          aria-current={pathname === '/profile' ? 'page' : undefined}
          aria-label="Открыть профиль"
          onClick={onNavigate}
          className="flex min-h-12 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] px-2 transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          <div
            className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-all ${expanded ? 'w-28 opacity-100' : 'w-0 opacity-0'}`}
          >
            <p className="truncate text-xs font-semibold">{user.name}</p>
            <p className="truncate text-[10px] text-[var(--color-text-secondary)]">{user.email}</p>
          </div>
        </Link>
        {onToggle ? (
          <div className="mt-1 flex justify-center">
            <IconButton
              label={expanded ? 'Свернуть навигацию' : 'Развернуть навигацию'}
              variant="ghost"
              onClick={onToggle}
              className="text-[var(--color-navigation-muted)]"
            >
              {expanded ? (
                <FiChevronLeft aria-hidden="true" className="size-5" />
              ) : (
                <FiChevronRight aria-hidden="true" className="size-5" />
              )}
            </IconButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
