// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const toastMock = vi.hoisted(() => vi.fn());
const actionMocks = vi.hoisted(() => ({
  createManualEventAction: vi.fn(),
  markEventReadAction: vi.fn(),
  markAllEventsReadAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/events',
  useRouter: () => routerMocks,
  useSearchParams: () => new URLSearchParams('vehicle=vehicle-1&severity=DANGER'),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: toastMock }) }));
vi.mock('../actions', () => actionMocks);

import { EventsWorkspace } from './EventsWorkspace';

const event = {
  key: 'vehicle-event:event-1',
  category: 'ALERT' as const,
  severity: 'DANGER' as const,
  title: 'Превышение скорости',
  description: 'Скорость выше лимита',
  recordedAt: '2026-07-27T09:00:00.000Z',
  isRead: false,
  isManual: false,
  vehicle: { id: 'vehicle-1', internalNumber: 'PLT-001', model: 'GWM WEY', imagePath: null },
  location: 'Москва',
  coordinates: null,
  telemetry: {
    speedKph: 95,
    heading: 90,
    odometerKm: 12345,
    fuelLevelPercent: 45.5,
    fuelVolumeLiters: 37.2,
  },
  source: { type: 'vehicle-event', id: 'event-1', href: '/vehicles/vehicle-1?tab=events' },
};

const props = {
  events: [event],
  nextCursor: { before: '2026-07-26T09:00:00.000Z', beforeKey: 'trip:trip-1' },
  stats: { total: 12, danger: 2, unread: 3, vehicles: 4 },
  vehicles: [{ id: 'vehicle-1', label: 'PLT-001 · GWM WEY' }],
  filters: { vehicleId: 'vehicle-1', severities: ['DANGER'] as 'DANGER'[], limit: 30 },
};

describe('workspace истории событий', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('показывает URL-backed фильтры, KPI и состояния danger/unread', () => {
    render(createElement(EventsWorkspace, props));

    expect((screen.getByLabelText('Автомобиль') as HTMLSelectElement).value).toBe('vehicle-1');
    expect((screen.getByLabelText('Важность') as HTMLSelectElement).value).toBe('DANGER');
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getAllByText('Критическое').length).toBeGreaterThan(1);
    expect(screen.getByText('Не прочитано')).toBeTruthy();
    expect(screen.getByText('Скорость: 95 км/ч')).toBeTruthy();
    expect(screen.getByText('Направление: Восток (90°)')).toBeTruthy();
    expect(screen.getByText(/Пробег: 12\s345 км/)).toBeTruthy();
    expect(screen.getByText('Уровень топлива: 45,5 %')).toBeTruthy();
    expect(screen.getByText('Объём топлива: 37,2 л')).toBeTruthy();
    expect(screen.getByTestId('events-desktop-filters')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Открыть фильтры' })).toBeTruthy();
  });

  it('отмечает одно и все видимые события прочитанными', async () => {
    actionMocks.markEventReadAction.mockResolvedValue({ status: 'success', message: 'Готово.' });
    actionMocks.markAllEventsReadAction.mockResolvedValue({
      status: 'success',
      message: 'Готово.',
    });
    render(createElement(EventsWorkspace, props));

    fireEvent.click(screen.getByRole('button', { name: 'Отметить прочитанным' }));
    await waitFor(() => expect(actionMocks.markEventReadAction).toHaveBeenCalledWith(event.key));
    fireEvent.click(screen.getByRole('button', { name: 'Отметить все прочитанными' }));
    await waitFor(() =>
      expect(actionMocks.markAllEventsReadAction).toHaveBeenCalledWith(props.filters),
    );
    expect(routerMocks.refresh).toHaveBeenCalledTimes(2);
  });

  it('закрывает ручную форму только после успеха и сохраняет значения при ошибке', async () => {
    actionMocks.createManualEventAction
      .mockResolvedValueOnce({ status: 'error', message: 'Ошибка сохранения.' })
      .mockResolvedValueOnce({ status: 'success', message: 'Запись добавлена.' });
    render(createElement(EventsWorkspace, props));

    fireEvent.click(screen.getByRole('button', { name: 'Добавить запись' }));
    const title = document.querySelector<HTMLInputElement>('input[name="title"]');
    if (!title) throw new Error('Поле заголовка не найдено.');
    fireEvent.change(title, { target: { value: 'Проверка формы' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить запись' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(title.value).toBe('Проверка формы');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить запись' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(routerMocks.refresh).toHaveBeenCalled();
  });

  it('сохраняет все фильтры в cursor-ссылке и различает пустую историю и пустой фильтр', () => {
    const multiFilters = {
      ...props.filters,
      categories: ['ALERT', 'FUEL'] as ('ALERT' | 'FUEL')[],
      severities: ['WARNING', 'DANGER'] as ('WARNING' | 'DANGER')[],
      read: 'all' as const,
    };
    const { rerender } = render(
      createElement(EventsWorkspace, { ...props, filters: multiFilters }),
    );
    const href = screen.getByRole('link', { name: 'Показать ещё' }).getAttribute('href') ?? '';
    expect(href).toContain('category=ALERT%2CFUEL');
    expect(href).toContain('severity=WARNING%2CDANGER');
    expect(href).toContain('beforeKey=trip%3Atrip-1');

    rerender(
      createElement(EventsWorkspace, {
        ...props,
        filters: multiFilters,
        events: [],
        nextCursor: null,
      }),
    );
    expect(screen.getByText('По выбранным фильтрам событий нет')).toBeTruthy();

    rerender(
      createElement(EventsWorkspace, {
        ...props,
        events: [],
        nextCursor: null,
        filters: { limit: 30, read: 'all' },
      }),
    );
    expect(screen.getByText('История пока пуста.')).toBeTruthy();
  });
});
