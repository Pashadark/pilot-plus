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
vi.mock('./RepairForm', async () => {
  const { createElement: createMockElement } = await import('react');
  return {
    RepairForm: ({ onSuccess }: { onSuccess: (message: string) => void }) =>
      createMockElement(
        'button',
        { type: 'button', onClick: () => onSuccess('Ремонт добавлен.') },
        'Завершить создание ремонта',
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
    render(createElement(MaintenanceWorkspace, { records: [], vehicles, rentals: [] }));

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

  it('разделяет создание ТО и ремонта на две понятные кнопки', () => {
    render(createElement(MaintenanceWorkspace, { records: [], vehicles, rentals: [] }));

    expect(screen.getByTestId('maintenance-desktop-table').className).toContain('xl:block');
    expect(screen.getByTestId('maintenance-mobile-list').className).toContain('xl:hidden');
    expect(screen.getByRole('button', { name: 'Запланировать ТО' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Добавить ремонт' }));
    expect(screen.getByRole('dialog').textContent).toContain('Добавить ремонт');
    expect(screen.getByRole('button', { name: 'Завершить создание ремонта' })).toBeTruthy();
  });

  it('прячет дополнительные условия обслуживания под компактный фильтр', () => {
    render(createElement(MaintenanceWorkspace, { records: [], vehicles, rentals: [] }));

    expect(screen.getByLabelText('Поиск по обслуживанию')).toBeTruthy();
    expect(screen.getByLabelText('Статус')).toBeTruthy();
    expect(screen.getByText('Все фильтры')).toBeTruthy();
    expect(screen.getByTestId('maintenance-advanced-filters')).toBeTruthy();
  });
});
