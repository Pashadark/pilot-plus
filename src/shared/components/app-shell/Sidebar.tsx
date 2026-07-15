'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navigation } from './navigation';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Основная навигация" className="space-y-1">
      {navigation.map((item) => {
        const Icon = item.icon;
        const isCurrent = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={onNavigate}
            className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors ${
              isCurrent
                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'text-[var(--color-navigation-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text)]'
            }`}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
