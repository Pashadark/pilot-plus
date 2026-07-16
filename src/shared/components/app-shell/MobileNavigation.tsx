'use client';

import { FiX } from 'react-icons/fi';

import { IconButton } from '@/shared/ui/IconButton';
import { Drawer } from '@/shared/ui/Overlays';

import { Sidebar } from './Sidebar';

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavigation({ open, onClose }: MobileNavigationProps) {
  return (
    <div className="md:hidden">
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        title="Мобильная навигация"
        className="mr-auto ml-0 max-w-[20rem] rounded-l-none rounded-r-[var(--radius-panel)] bg-[var(--color-navigation)] text-[var(--color-text-inverse)]"
      >
        <div className="mb-5 flex justify-end">
          <IconButton label="Закрыть меню" variant="ghost" onClick={onClose}>
            <FiX aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <Sidebar onNavigate={onClose} />
      </Drawer>
    </div>
  );
}
