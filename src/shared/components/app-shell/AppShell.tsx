import type { ReactNode } from 'react';

import { ShellFrame } from './ShellFrame';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: readonly Breadcrumb[];
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  return <ShellFrame breadcrumbs={breadcrumbs}>{children}</ShellFrame>;
}
