// @vitest-environment jsdom

import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';

import { ShellFrame } from './ShellFrame';

vi.mock('@/shared/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: vi.fn() }));
vi.mock('./Header', () => ({ Header: () => null }));
vi.mock('./Sidebar', () => ({ Sidebar: () => <div>navigation</div> }));
vi.mock('./ScrollToTopButton', () => ({ ScrollToTopButton: () => null }));

const user = {
  id: 'user-1',
  name: 'Павел Седов',
  email: 'pavel@example.com',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  document.documentElement.dataset.interface = 'obsidian';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: '(min-width: 1024px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(cleanup);

describe('ShellFrame', () => {
  it('keeps the sidebar compact below the desktop breakpoint', () => {
    render(
      <ThemeProvider>
        <ShellFrame
          breadcrumbs={[]}
          user={user}
          systemHealthSummary={{
            state: 'healthy',
            count: 4,
            total: 4,
            checkedAt: '2026-09-10T10:00:00.000Z',
          }}
          notifications={[]}
        >
          <p>content</p>
        </ShellFrame>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('desktop-sidebar').dataset.interfaceShell).toBe('sidebar');
    expect(screen.getByRole('main').dataset.interfaceShell).toBe('content');
    expect(screen.getByTestId('app-shell').dataset.sidebarExpanded).toBe('false');
    fireEvent.mouseEnter(screen.getByTestId('desktop-sidebar'));
    expect(screen.getByTestId('desktop-sidebar').dataset.expanded).not.toBe('true');
    expect(screen.getByTestId('app-shell').dataset.sidebarExpanded).toBe('false');
    fireEvent.mouseLeave(screen.getByTestId('desktop-sidebar'));
    expect(screen.getByTestId('desktop-sidebar').dataset.expanded).not.toBe('true');
  });

  it('uses the standard desktop breakpoint so ordinary office windows can expand it', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: '(min-width: 1024px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });

    render(
      <ThemeProvider>
        <ShellFrame
          breadcrumbs={[]}
          user={user}
          systemHealthSummary={{
            state: 'healthy',
            count: 4,
            total: 4,
            checkedAt: '2026-09-10T10:00:00.000Z',
          }}
          notifications={[]}
        >
          <p>content</p>
        </ShellFrame>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('app-shell').dataset.sidebarExpanded).toBe('true');
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
  });
});
