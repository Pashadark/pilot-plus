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
  usePathname: () => '/maintenance',
  useRouter: () => routerMocks,
  useSearchParams: () => new URLSearchParams('view=list'),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));
vi.mock('../actions', () => ({
  transitionMaintenanceAction: vi.fn(),
}));
vi.mock('./MaintenanceForm', async () => {
  const { createElement: createMockElement } = await import('react');
  return {
    MaintenanceForm: ({ onSuccess }: { onSuccess: (message: string) => void }) =>
      createMockElement(
        'button',
        { type: 'button', onClick: () => onSuccess('ТО запланировано.') },
        'Завершить создание ТО',
      ),
  };
});

import { MaintenanceWorkspace } from './MaintenanceWorkspace';

const vehicles = [{ id: 'vehicle-1', label: 'PLT-001 · GWM WEY', image: null }] as const;

describe('жизненный цикл создания ТО в workspace', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('на каждый success один раз показывает toast, закрывает dialog и обновляет серверные данные', async () => {
    render(createElement(MaintenanceWorkspace, { records: [], vehicles }));

    const search = screen.getByLabelText('Поиск по обслуживанию') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Сохранённый фильтр' } });

    for (let index = 0; index < 2; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Запланировать ТО' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Завершить создание ТО' }));
      await waitFor(() => expect(dialog.isConnected).toBe(false));
    }

    expect(showToastMock).toHaveBeenCalledTimes(2);
    expect(showToastMock).toHaveBeenCalledWith({
      tone: 'success',
      title: 'ТО запланировано.',
    });
    expect(routerMocks.refresh).toHaveBeenCalledTimes(2);
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(search.value).toBe('Сохранённый фильтр');
  });
});
