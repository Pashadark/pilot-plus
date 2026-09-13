// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const showToast = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

import { RentalRowActionsMenu } from './RentalRowActionsMenu';

afterEach(() => {
  cleanup();
  showToast.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RentalRowActionsMenu', () => {
  it('keeps missing document actions visible and disabled', async () => {
    const user = userEvent.setup();
    render(
      <RentalRowActionsMenu
        rentalId="rental-1"
        clientId="client-1"
        vehicleId="vehicle-1"
        contractNumber="ME-2026-0001"
        documents={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ещё действия ME-2026-0001' }));
    expect((screen.getByRole('menuitem', { name: 'Скачать PDF' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('menuitem', { name: 'Скачать DOCX' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('reports clipboard failure and stays usable', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    render(
      <RentalRowActionsMenu
        rentalId="rental-1"
        clientId="client-1"
        vehicleId="vehicle-1"
        contractNumber="ME-2026-0001"
        documents={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ещё действия ME-2026-0001' }));
    await user.click(screen.getByRole('menuitem', { name: 'Скопировать ссылку' }));
    expect(showToast).toHaveBeenCalledWith({
      tone: 'danger',
      title: 'Не удалось скопировать.',
      description: 'Разрешите доступ к буферу обмена и повторите попытку.',
    });
    expect(screen.getByRole('menu', { name: 'Действия ME-2026-0001' })).toBeTruthy();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <RentalRowActionsMenu
        rentalId="rental-1"
        clientId="client-1"
        vehicleId="vehicle-1"
        contractNumber="ME-2026-0001"
        documents={[]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Ещё действия ME-2026-0001' });

    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('stays open and follows its trigger while the page scrolls', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('innerWidth', 1200);
    vi.stubGlobal('innerHeight', 520);
    const animationFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(
      <RentalRowActionsMenu
        rentalId="rental-1"
        clientId="client-1"
        vehicleId="vehicle-1"
        contractNumber="ME-2026-0001"
        documents={[]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Ещё действия ME-2026-0001' });
    let triggerTop = 180;
    vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top: triggerTop,
          right: 980,
          bottom: triggerTop + 40,
          left: 940,
          width: 40,
          height: 40,
          x: 940,
          y: triggerTop,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Действия ME-2026-0001' });
    await waitFor(() => expect(menu.style.top).toBe('180px'));
    act(() => animationFrames.splice(0).forEach((callback) => callback(0)));
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      right: 0,
      bottom: 500,
      left: 0,
      width: 304,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.scroll(window);
    act(() => animationFrames.splice(0).forEach((callback) => callback(0)));
    await waitFor(() => expect(menu.style.top).toBe('180px'));
    expect(menu.style.maxHeight).toBe('328px');

    triggerTop = 260;
    fireEvent.scroll(window);
    act(() => animationFrames.splice(0).forEach((callback) => callback(0)));

    expect(screen.getByRole('menu', { name: 'Действия ME-2026-0001' })).toBe(menu);
    await waitFor(() => expect(menu.style.top).toBe('260px'));
    expect(menu.style.maxHeight).toBe('248px');
  });
});
