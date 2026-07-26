// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));
const showToastMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => '/wash',
  useRouter: () => routerMocks,
  useSearchParams: () => new URLSearchParams('view=list'),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));
vi.mock('../actions', () => ({
  transitionWashAction: vi.fn(),
}));
vi.mock('./WashForm', async () => {
  const { createElement: createMockElement } = await import('react');
  return {
    WashForm: ({ onSuccess }: { onSuccess: (message: string) => void }) =>
      createMockElement(
        'button',
        { type: 'button', onClick: () => onSuccess('Мойка запланирована.') },
        'Завершить создание мойки',
      ),
  };
});

import { WashWorkspace } from './WashWorkspace';

const vehicles = [{ id: 'vehicle-1', label: 'PLT-001 · GWM WEY', image: null }] as const;

describe('жизненный цикл создания мойки в workspace', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('на каждый success один раз показывает toast, закрывает dialog и обновляет серверные данные', async () => {
    render(
      createElement(WashWorkspace, {
        records: [],
        vehicles,
        latestCompletedWashes: [],
      }),
    );

    const search = screen.getByLabelText('Поиск по мойке') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Сохранённый фильтр' } });

    for (let index = 0; index < 2; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Запланировать мойку' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Завершить создание мойки' }));
      await waitFor(() => expect(dialog.isConnected).toBe(false));
    }

    expect(showToastMock).toHaveBeenCalledTimes(2);
    expect(showToastMock).toHaveBeenCalledWith({
      tone: 'success',
      title: 'Мойка запланирована.',
    });
    expect(routerMocks.refresh).toHaveBeenCalledTimes(2);
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(search.value).toBe('Сохранённый фильтр');
  });
});
