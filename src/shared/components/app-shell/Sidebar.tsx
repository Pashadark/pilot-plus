'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiChevronLeft, FiChevronRight, FiUser } from 'react-icons/fi';

import { IconButton } from '@/shared/ui/IconButton';

import { navigation } from './navigation';

interface SidebarProps {
  expanded?: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
}

export function Sidebar({ expanded = true, onNavigate, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-20 shrink-0 items-center overflow-hidden border-b px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)] text-base font-black text-white">
            P+
          </span>
          <div
            className={`overflow-hidden whitespace-nowrap transition-all ${expanded ? 'w-32 opacity-100' : 'w-0 opacity-0'}`}
          >
            <p className="text-xl leading-5 font-bold tracking-tight">
              Pilot<span className="text-[var(--color-primary)]">+</span>
            </p>
            <p className="mt-1 text-[9px] tracking-[0.18em] text-[var(--color-text-secondary)] uppercase">
              GPS monitoring
            </p>
          </div>
        </div>
      </div>
      <nav aria-label="Основная навигация" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isCurrent = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              aria-label={item.label}
              onClick={onNavigate}
              className={`flex min-h-11 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-colors ${
                isCurrent
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'text-[var(--color-navigation-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]'
              }`}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span
                className={`overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ${
                  expanded ? 'w-40 opacity-100' : 'w-0 opacity-0'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="flex min-h-12 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] px-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <FiUser aria-hidden="true" />
          </span>
          <div
            className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-all ${expanded ? 'w-28 opacity-100' : 'w-0 opacity-0'}`}
          >
            <p className="truncate text-xs font-semibold">Павел Седов</p>
            <p className="truncate text-[10px] text-[var(--color-text-secondary)]">Администратор</p>
          </div>
        </div>
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
