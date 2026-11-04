'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import type { PilotNotification } from '@/modules/notifications/types';
import type { NotificationMeta } from '@/modules/notifications/pagination';

import { ShellFrame } from './ShellFrame';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: readonly Breadcrumb[];
}

interface AppShellContextValue {
  notificationMeta?: NotificationMeta;
  user: SafeUser;
  systemHealthSummary: SystemHealthSummary;
  notifications: readonly PilotNotification[];
  openFineCount?: number;
  openLeadCount?: number;
  openDepositCount?: number;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellUserProvider({
  children,
  user,
  systemHealthSummary,
  notifications,
  notificationMeta,
  openFineCount = 0,
  openLeadCount = 0,
  openDepositCount = 0,
}: {
  children: ReactNode;
  user: SafeUser;
  systemHealthSummary: SystemHealthSummary;
  notifications: readonly PilotNotification[];
  notificationMeta?: NotificationMeta;
  openFineCount?: number;
  openLeadCount?: number;
  openDepositCount?: number;
}) {
  return (
    <AppShellContext.Provider
      value={{
        user,
        systemHealthSummary,
        notifications,
        notificationMeta,
        openFineCount,
        openLeadCount,
        openDepositCount,
      }}
    >
      {children}
    </AppShellContext.Provider>
  );
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  const context = useContext(AppShellContext);
  if (!context) throw new Error('AppShell должен использоваться внутри AppShellUserProvider.');

  return (
    <ShellFrame
      breadcrumbs={breadcrumbs}
      user={context.user}
      systemHealthSummary={context.systemHealthSummary}
      notifications={context.notifications}
      notificationMeta={context.notificationMeta}
      openFineCount={context.openFineCount}
      openLeadCount={context.openLeadCount}
      openDepositCount={context.openDepositCount}
    >
      {children}
    </ShellFrame>
  );
}
