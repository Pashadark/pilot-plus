// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnchoredPopover } from './AnchoredPopover';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AnchoredPopover', () => {
  it('renders in a portal, closes on Escape and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="clipping-parent" style={{ overflow: 'hidden' }}>
        <AnchoredPopover ariaLabel="Профиль и компания" panelRole="menu" trigger={<span>П</span>}>
          <a href="/profile" role="menuitem">
            Открыть профиль
          </a>
        </AnchoredPopover>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Профиль и компания' });
    await user.click(trigger);
    const menu = screen.getByRole('menu');

    expect(menu.parentElement).toBe(document.body);
    expect(menu.getAttribute('data-overlay-layer')).toBe('header');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('clamps a desktop panel inside the viewport and updates on scroll', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 720 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(
      <AnchoredPopover ariaLabel="Уведомления" trigger={<span>У</span>}>
        <p>Содержимое</p>
      </AnchoredPopover>,
    );

    const trigger = screen.getByRole('button', { name: 'Уведомления' });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 690,
      y: 12,
      top: 12,
      right: 718,
      bottom: 56,
      left: 690,
      width: 28,
      height: 44,
      toJSON: () => ({}),
    });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    Object.defineProperty(dialog, 'offsetWidth', { configurable: true, value: 320 });
    Object.defineProperty(dialog, 'offsetHeight', { configurable: true, value: 400 });
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(dialog.style.left).toBe('392px');
      expect(dialog.style.top).toBe('64px');
    });

    fireEvent.scroll(window);
    expect(raf).toHaveBeenCalled();
  });

  it('uses a mobile bottom sheet with a labelled heading', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const user = userEvent.setup();
    render(
      <AnchoredPopover
        ariaLabel="Профиль и компания"
        mobileTitle="Профиль"
        trigger={<span>П</span>}
      >
        <p>Павел Седов</p>
      </AnchoredPopover>,
    );

    await user.click(screen.getByRole('button', { name: 'Профиль и компания' }));

    expect(
      screen.getByRole('dialog', { name: 'Профиль' }).getAttribute('data-mobile-sheet'),
    ).toBe('true');
  });
});
