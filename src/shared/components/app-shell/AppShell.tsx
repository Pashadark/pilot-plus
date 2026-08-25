'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { SafeUser } from '@/modules/auth/types';
import type { SystemHealthSummary } from '@/modules/system-health/types';
import type { PilotNotification } from '@/modules/notifications/types';

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
  user: SafeUser;
  systemHealthSummary: SystemHealthSummary;
  notifications: readonly PilotNotification[];
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellUserProvider({
  children,
  user,
  systemHealthSummary,
  notifications,
}: {
  children: ReactNode;
  user: SafeUser;
  systemHealthSummary: SystemHealthSummary;
  notifications: readonly PilotNotification[];
}) {
  return (
    <AppShellContext.Provider value={{ user, systemHealthSummary, notifications }}>
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
    >
      {children}
    </ShellFrame>
  );
}
