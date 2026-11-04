// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SafeUser } from '@/modules/auth/types';
import { MobileNavigation } from './MobileNavigation';

const route = vi.hoisted(() => ({ pathname: '/vehicles/car-1' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
const user: SafeUser = {
  id: 'u',
  name: 'Admin',
  email: 'admin@example.test',
  role: 'SUPER_ADMIN',
  canAccessAdmin: true,
  capabilities: ['CLIENTS', 'RENTALS', 'FINES'],
};
function Navigation({ currentUser = user }: { currentUser?: SafeUser }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileNavigation
      open={open}
      onOpenChange={setOpen}
      user={currentUser}
      systemHealthSummary={{ state: 'healthy', count: 4, total: 4, checkedAt: '2026-10-08' }}
    />
  );
}
afterEach(() => {
  cleanup();
  route.pathname = '/vehicles/car-1';
});

describe('mobile navigation dock', () => {
  it('shows four primary destinations and More, with nested route active', () => {
    render(<Navigation />);
    const dock = screen.getByRole('navigation', { name: 'Мобильная навигация' });
    expect(
      within(dock)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Главная', 'Аренды', 'Карта', 'Автопарк']);
    expect(within(dock).getByRole('button', { name: 'Ещё' })).toBeTruthy();
    expect(within(dock).getByRole('link', { name: 'Автопарк' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(dock).getByRole('link', { name: 'Главная' }).hasAttribute('aria-current')).toBe(
      false,
    );
  });
  it('opens remaining sections and closes on Escape, restoring focus', async () => {
    render(<Navigation />);
    const trigger = screen.getByRole('button', { name: 'Ещё' });
    trigger.focus();
    fireEvent.click(trigger);
    const sheet = screen.getByRole('dialog', { name: 'Все разделы' });
    expect(within(sheet).getByRole('navigation').className).toContain('flex-col');
    expect(sheet.querySelector('[data-sheet-handle]')).toBeTruthy();
    expect(within(sheet).getByRole('link', { name: 'Клиенты' })).toBeTruthy();
    expect(within(sheet).getByRole('link', { name: 'Состояние системы' })).toBeTruthy();
    expect(within(sheet).queryByRole('link', { name: 'Автопарк' })).toBeNull();
    expect(within(sheet).queryByText('Открыть профиль')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(sheet).getByRole('button', { name: 'Закрыть меню' }),
      ),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('closes immediately when choosing a route or pressing the backdrop', () => {
    render(<Navigation />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    screen
      .getByRole('link', { name: 'Клиенты' })
      .addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(screen.getByRole('link', { name: 'Клиенты' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('closes an open sheet after an external route change', () => {
    const view = render(<Navigation />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    route.pathname = '/map';
    view.rerender(<Navigation />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('traps keyboard focus within the sheet', async () => {
    render(<Navigation />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    const sheet = screen.getByRole('dialog');
    const candidates = Array.from(sheet.querySelectorAll<HTMLElement>('button, a'));
    for (const candidate of candidates) {
      vi.spyOn(candidate, 'getClientRects').mockReturnValue([
        {} as DOMRect,
      ] as unknown as DOMRectList);
    }
    const first = candidates[0];
    const last = candidates.at(-1)!;
    await waitFor(() => expect(document.activeElement).toBe(first));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });
  it('respects capability and admin policy without duplicate primary routes', () => {
    render(
      <Navigation
        currentUser={{ ...user, role: 'MEMBER', canAccessAdmin: false, capabilities: [] }}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Аренды' })).toBeNull();
    expect(
      screen.getByText('Аренды').closest('[aria-disabled]')?.getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    for (const name of ['Клиенты', 'Заявки', 'Штрафы', 'Администрирование', 'Состояние системы']) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
    expect(screen.getByRole('link', { name: 'Мойка' })).toBeTruthy();
  });
});
