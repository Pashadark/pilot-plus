'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

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
      <div className="flex h-16 shrink-0 items-center justify-center overflow-hidden border-b px-3">
        <span className="text-xl font-semibold whitespace-nowrap text-[var(--color-text-inverse)]">
          {expanded ? 'Pilot+' : 'P+'}
        </span>
      </div>
      <nav aria-label="Основная навигация" className="flex-1 space-y-1 overflow-y-auto p-3">
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
              className={`flex min-h-11 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors ${
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
      {onToggle ? (
        <div className="flex shrink-0 justify-center border-t p-2">
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
  );
}
