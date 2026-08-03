// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/shared/providers/ThemeProvider';

import { Header } from './Header';

vi.mock('./MobileNavigation', () => ({ MobileNavigation: () => null }));

const user = {
  id: 'user-1',
  name: 'Павел Седов',
  email: 'pavel@example.com',
  role: 'ADMIN' as const,
};

afterEach(cleanup);

describe('шапка приложения', () => {
  it('показывает центр уведомлений и реальные данные профиля', async () => {
    const browserUser = userEvent.setup();
    render(
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
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: /Уведомления:/ })).toBeTruthy();
    await browserUser.click(screen.getByRole('button', { name: 'Профиль и компания' }));
    expect(screen.getByText(user.name)).toBeTruthy();
    expect(screen.getByText(user.email)).toBeTruthy();
    const profileLink = screen.getByRole('menuitem', { name: 'Открыть профиль' });
    expect(profileLink.tagName).toBe('A');
    expect(profileLink.getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('img', { name: user.name })).toBeTruthy();
  });
});
