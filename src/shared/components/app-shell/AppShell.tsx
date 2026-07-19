'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { SafeUser } from '@/modules/auth/types';

import { ShellFrame } from './ShellFrame';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: readonly Breadcrumb[];
}

const AppShellUserContext = createContext<SafeUser | null>(null);

export function AppShellUserProvider({ children, user }: { children: ReactNode; user: SafeUser }) {
  return <AppShellUserContext.Provider value={user}>{children}</AppShellUserContext.Provider>;
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  const user = useContext(AppShellUserContext);
  if (!user) throw new Error('AppShell должен использоваться внутри AppShellUserProvider.');

  return (
    <ShellFrame breadcrumbs={breadcrumbs} user={user}>
      {children}
    </ShellFrame>
  );
}
