// @vitest-environment jsdom

import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';
import { ToastProvider } from '@/shared/providers/ToastProvider';

import { Header } from './Header';

const mobileNavigationMock = vi.hoisted(() => vi.fn(() => null));

vi.mock('./MobileNavigation', () => ({ MobileNavigation: mobileNavigationMock }));

const user = {
  id: 'user-1',
  name: 'Павел Седов',
  email: 'pavel@example.com',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

afterEach(cleanup);

describe('шапка приложения', () => {
  it('не дублирует хлебные крошки и название продукта над заголовком страницы', () => {
    render(
      <ToastProvider>
        <ThemeProvider>
          <Header
            breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Командный центр' }]}
            user={user}
            mobileNavigationOpen={false}
            onOpenMobileNavigation={vi.fn()}
            onCloseMobileNavigation={vi.fn()}
            systemHealthSummary={{
              state: 'healthy',
              count: 3,
              total: 4,
              checkedAt: '2026-08-03T09:00:00.000Z',
            }}
            notifications={[]}
          />
        </ThemeProvider>
      </ToastProvider>,
    );

    expect(screen.queryByText('СУПА ПРО')).toBeNull();
    expect(screen.queryByText('Командный центр')).toBeNull();
    expect(screen.queryByTestId('mobile-breadcrumbs')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Открыть меню' })).toBeNull();
    expect(screen.getByRole('link', { name: 'СУПА ПРО — главная' })).toBeTruthy();
    expect(screen.getByTestId('app-header').dataset.scrolled).toBe('false');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    fireEvent.scroll(window);
    expect(screen.getByTestId('app-header').dataset.scrolled).toBe('true');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    fireEvent.scroll(window);
    expect(screen.getByTestId('app-header').dataset.scrolled).toBe('false');
  });

  it('показывает центр уведомлений и реальные данные профиля', async () => {
    const browserUser = userEvent.setup();
    render(
      <ToastProvider>
        <ThemeProvider>
          <Header
            breadcrumbs={[]}
            user={user}
            mobileNavigationOpen={false}
            onOpenMobileNavigation={vi.fn()}
            onCloseMobileNavigation={vi.fn()}
            systemHealthSummary={{
              state: 'healthy',
              count: 3,
              total: 4,
              checkedAt: '2026-08-03T09:00:00.000Z',
            }}
            notifications={[]}
          />
        </ThemeProvider>
      </ToastProvider>,
    );

    expect(screen.getByRole('button', { name: /Уведомления:/ })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Тёмная тема' })).toBeTruthy();
    await browserUser.click(screen.getByRole('button', { name: 'Профиль и компания' }));
    expect(screen.getByText(user.name)).toBeTruthy();
    expect(screen.getByText(user.email)).toBeTruthy();
    const profileLink = screen.getByRole('menuitem', { name: 'Открыть профиль' });
    expect(profileLink.tagName).toBe('A');
    expect(profileLink.getAttribute('href')).toBe('/profile');
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(screen.getByRole('img', { name: user.name })).toBeTruthy();
    expect(mobileNavigationMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ canAccessAdmin: true }) }),
      undefined,
    );
  });
});
