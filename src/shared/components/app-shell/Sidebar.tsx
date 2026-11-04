'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiLogOut } from 'react-icons/fi';

import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import { logoutAction } from '@/modules/auth/actions';
import { IconButton } from '@/shared/ui/IconButton';

import { getVisibleNavigation } from './navigation';

interface SidebarProps {
  expanded?: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
  systemHealthSummary: SystemHealthSummary;
  user: SafeUser;
  openFineCount?: number;
  openLeadCount?: number;
  openDepositCount?: number;
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
  openFineCount = 0,
  openLeadCount = 0,
  openDepositCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const visibleNavigation = getVisibleNavigation(user);
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
        [
          '/statistics',
          '/fines',
          '/deposits',
          '/maintenance',
          '/wash',
          '/devices',
          '/events',
        ].includes(item.href),
      ),
    },
    {
      label: 'Система',
      items: visibleNavigation.filter((item) =>
        ['/admin', '/system', '/ui-kit'].includes(item.href),
      ),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="graphite-sidebar-brand flex h-20 shrink-0 items-center overflow-hidden border-b px-4">
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
            <button
              type="button"
              aria-label={`${group.label}: разделы меню`}
              aria-expanded={!closedGroups.includes(group.label)}
              onClick={() =>
                setClosedGroups((current) =>
                  current.includes(group.label)
                    ? current.filter((label) => label !== group.label)
                    : [...current, group.label],
                )
              }
              data-navigation-label="true"
              tabIndex={expanded ? 0 : -1}
              className={`sidebar-navigation-group-label flex w-full cursor-pointer items-center justify-between overflow-hidden px-3 text-[10px] font-semibold tracking-[0.12em] text-[var(--color-text-muted)] uppercase transition-[height,opacity,padding] duration-200 ${expanded ? 'h-8 pb-1 opacity-100' : 'h-0 p-0 opacity-0'}`}
            >
              {group.label}
              <FiChevronDown
                aria-hidden="true"
                className={`size-3 transition-transform ${closedGroups.includes(group.label) ? '-rotate-90' : ''}`}
              />
            </button>
            <div className="space-y-1" hidden={expanded && closedGroups.includes(group.label)}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isCurrent =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isCurrent ? 'page' : undefined}
                    aria-label={
                      item.href === '/system'
                        ? `Состояние системы: ${healthPresentation[systemHealthSummary.state].label}, ${systemHealthSummary.count} из ${systemHealthSummary.total}`
                        : item.label
                    }
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
                      {item.href === '/fines' && openFineCount > 0 ? (
                        <span
                          data-fines-count={openFineCount}
                          className="ml-1.5 inline-flex h-5 min-w-8 items-center justify-center rounded-full bg-[#0067ff] px-2 align-middle text-[10px] leading-none font-bold text-white tabular-nums"
                        >
                          {openFineCount}
                        </span>
                      ) : null}
                      {item.href === '/leads' && openLeadCount > 0 ? (
                        <span
                          data-leads-count={openLeadCount}
                          className="ml-1.5 inline-flex h-5 min-w-8 items-center justify-center rounded-full bg-[#0067ff] px-2 align-middle text-[10px] leading-none font-bold text-white tabular-nums"
                        >
                          {openLeadCount}
                        </span>
                      ) : null}
                      {item.href === '/deposits' && openDepositCount > 0 ? (
                        <span
                          data-deposits-count={openDepositCount}
                          className="ml-1.5 inline-flex h-5 min-w-8 items-center justify-center rounded-full bg-[#0067ff] px-2 align-middle text-[10px] leading-none font-bold text-white tabular-nums"
                        >
                          {openDepositCount}
                        </span>
                      ) : null}
                      {item.href === '/system' && (
                        <small className="mt-1 block text-[10px] text-[var(--color-text-secondary)]">
                          {healthPresentation[systemHealthSummary.state].label}{' '}
                          {systemHealthSummary.count}/{systemHealthSummary.total}
                        </small>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
      <div className="graphite-sidebar-footer border-t p-3">
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Выйти"
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--color-navigation-muted)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]"
          >
            <FiLogOut aria-hidden="true" className="size-5 shrink-0" />
            {expanded && <span>Выйти</span>}
          </button>
        </form>
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
