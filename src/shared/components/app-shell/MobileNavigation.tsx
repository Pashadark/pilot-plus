'use client';

import { FiX } from 'react-icons/fi';

import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import { IconButton } from '@/shared/ui/IconButton';
import { Drawer } from '@/shared/ui/Overlays';

import { Sidebar } from './Sidebar';

interface MobileNavigationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SafeUser;
  systemHealthSummary: SystemHealthSummary;
}

export function MobileNavigation({
  open,
  onOpenChange,
  user,
  systemHealthSummary,
}: MobileNavigationProps) {
  const close = () => onOpenChange(false);

  return (
    <div className="md:hidden">
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title="Мобильная навигация"
        className="mr-auto ml-0 max-w-[20rem] rounded-l-none rounded-r-[var(--radius-panel)] bg-[var(--color-navigation)] text-[var(--color-text-inverse)]"
      >
        <div className="mb-5 flex justify-end">
          <IconButton label="Закрыть меню" variant="ghost" onClick={close}>
            <FiX aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <Sidebar onNavigate={close} user={user} systemHealthSummary={systemHealthSummary} />
      </Drawer>
    </div>
  );
}
