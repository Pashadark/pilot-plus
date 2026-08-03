// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '@/shared/ui';

import { CalendarEventDialog } from './CalendarEventDialog';
import { OperationsCalendar } from './OperationsCalendar';
import type { OperationsCalendarEvent } from './types';
import * as operationsCalendar from '.';

const baseEvent: OperationsCalendarEvent = {
  id: 'maintenance-1',
  startsAt: '2026-07-22T06:30:00.000Z',
  title: 'Плановое ТО',
  vehicleLabel: 'PLT-001 · GWM WEY · А 123 МР 77',
  statusLabel: 'Запланировано',
  tone: 'primary',
  icon: 'tool',
};

function createCalendarProps(events: readonly OperationsCalendarEvent[] = [baseEvent]) {
  return {
    events,
    month: '2026-07',
    onMonthChange: vi.fn(),
    onToday: vi.fn(),
  };
}

function fourEvents() {
  return Array.from({ length: 4 }, (_, index) => ({
    ...baseEvent,
    id: `maintenance-${index + 1}`,
    title: `Работа ${index + 1}`,
    startsAt: `2026-07-22T0${index + 5}:30:00.000Z`,
  }));
}

function getTextToken(element: HTMLElement) {
  const match = element.className.match(/text-\[var\(--([^)]+)\)\]/);
  if (!match?.[1]) throw new Error('У элемента отсутствует text color token');
  return match[1];
}

afterEach(() => cleanup());

describe('OperationsCalendar', () => {
  it('публикует desktop-grid с полными заголовками и мобильную повестку', () => {
    render(createElement(OperationsCalendar, createCalendarProps()));

    const grid = screen.getByRole('grid', { name: 'Календарь: Июль 2026' });
    expect(screen.getByTestId('operations-calendar-grid')).toBe(grid);
    expect(screen.getByTestId('operations-calendar-agenda')).not.toBeNull();
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(35);
    expect(within(grid).getByRole('columnheader', { name: 'Понедельник' })).not.toBeNull();
    expect(within(grid).getByRole('gridcell', { name: /Среда 22 июля 2026 г\./ })).not.toBeNull();
  });

  it('раскрывает и скрывает остаток дня со стабильным фокусом и live-объявлением', async () => {
    const user = userEvent.setup();
    render(createElement(OperationsCalendar, createCalendarProps(fourEvents())));
    const grid = within(screen.getByTestId('operations-calendar-grid'));
    const toggle = grid.getByRole('button', { name: 'Ещё 1' });
    const controlledId = toggle.getAttribute('aria-controls');

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(controlledId).not.toBeNull();
    expect(document.getElementById(controlledId ?? '')).not.toBeNull();
    expect(grid.queryByRole('button', { name: /Работа 4/ })).toBeNull();
    expect(grid.queryByRole('status')).toBeNull();

    toggle.focus();
    await user.keyboard('{Enter}');

    expect(toggle.textContent).toBe('Скрыть');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(toggle);
    expect(grid.getByRole('button', { name: /Работа 4/ })).not.toBeNull();
    expect(grid.getByRole('status').textContent).toContain(
      'Показаны все 4 записи за среда, 22 июля 2026 г.',
    );

    await user.keyboard(' ');

    expect(toggle.textContent).toBe('Ещё 1');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    expect(grid.queryByRole('button', { name: /Работа 4/ })).toBeNull();
    expect(grid.getByRole('status').textContent).toContain(
      'Показаны первые 3 из 4 записей за среда, 22 июля 2026 г.',
    );
  });

  it('показывает компактную двухстрочную полосу, а статус оставляет в accessible name', () => {
    render(createElement(OperationsCalendar, createCalendarProps()));
    const grid = within(screen.getByTestId('operations-calendar-grid'));
    const eventButton = grid.getByRole('button', {
      name: /Среда, 22 июля 2026 г\., 09:30, Плановое ТО, PLT-001 · GWM WEY · А 123 МР 77, статус: Запланировано/,
    });

    expect(eventButton).toBe(grid.getByTestId('operations-calendar-event'));
    expect(eventButton.textContent).toContain('09:30');
    expect(eventButton.textContent).toContain('Плановое ТО');
    expect(eventButton.textContent).toContain('А 123 МР 77');
    expect(eventButton.textContent).not.toContain('Запланировано');
    expect(eventButton.className).toContain('min-h-11');
    expect(eventButton.className).toContain('border-l-4');
  });

  it('показывает работу и автомобиль двумя читаемыми строками внутри нужной даты', () => {
    render(createElement(OperationsCalendar, createCalendarProps()));
    const grid = within(screen.getByTestId('operations-calendar-grid'));
    const eventButton = grid.getByRole('button', {
      name: /Среда, 22 июля 2026 г\., 09:30, Плановое ТО, PLT-001 · GWM WEY · А 123 МР 77, статус: Запланировано/,
    });
    const day = grid.getByRole('gridcell', { name: /Среда 22 июля 2026 г\./ });

    expect(within(day).getByTestId('operations-calendar-event')).toBe(eventButton);
    expect(within(eventButton).getByTestId('operations-calendar-event-vehicle').textContent).toBe(
      baseEvent.vehicleLabel,
    );
    expect(within(eventButton).queryByTestId('operations-calendar-event-status')).toBeNull();
    expect(day.className).toContain('min-h-44');
  });

  it('использует secondary token для подписи автомобиля', () => {
    render(createElement(OperationsCalendar, createCalendarProps()));
    const eventButton = within(screen.getByTestId('operations-calendar-grid')).getByRole('button', {
      name: /Плановое ТО/,
    });
    expect(getTextToken(within(eventButton).getByText(baseEvent.vehicleLabel))).toBe(
      'color-text-secondary',
    );
  });

  it('вызывает callbacks предыдущего, следующего месяца и сегодня', async () => {
    const user = userEvent.setup();
    const props = createCalendarProps();
    render(createElement(OperationsCalendar, props));

    await user.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }));
    await user.click(screen.getByRole('button', { name: 'Сегодня' }));

    expect(props.onMonthChange.mock.calls).toEqual([['2026-06'], ['2026-08']]);
    expect(props.onToday).toHaveBeenCalledTimes(1);
  });

  it('открывает dialog клавиатурой, закрывает Escape и возвращает фокус', async () => {
    const user = userEvent.setup();
    render(createElement(OperationsCalendar, createCalendarProps()));
    const eventButton = within(screen.getByTestId('operations-calendar-grid')).getByRole('button', {
      name: /Среда, 22 июля 2026 г\., 09:30, Плановое ТО/,
    });

    eventButton.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog', { name: 'Плановое ТО' })).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(eventButton);
  });

  it('заменяет generic badge результатом доменного status renderer', async () => {
    const user = userEvent.setup();
    const renderEventStatus = vi.fn((event: OperationsCalendarEvent) =>
      createElement('span', { 'data-testid': 'domain-event-status' }, `ТО: ${event.statusLabel}`),
    );
    render(
      createElement(OperationsCalendar, {
        ...createCalendarProps(),
        renderEventStatus,
      }),
    );

    await user.click(
      within(screen.getByTestId('operations-calendar-grid')).getByRole('button', {
        name: /Плановое ТО/,
      }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Плановое ТО' });
    expect(within(dialog).getByTestId('domain-event-status').textContent).toBe('ТО: Запланировано');
    expect(within(dialog).queryByText('Запланировано', { exact: true })).toBeNull();
    expect(renderEventStatus).toHaveBeenCalledWith(baseEvent);
  });

  it('показывает доменные поля только в details dialog', async () => {
    const user = userEvent.setup();
    const renderEventDetails = vi.fn((event: OperationsCalendarEvent) =>
      createElement('div', { 'data-testid': 'domain-event-details' }, `Подрядчик: ${event.id}`),
    );
    render(
      createElement(OperationsCalendar, {
        ...createCalendarProps(),
        renderEventDetails,
      }),
    );

    expect(screen.queryByTestId('domain-event-details')).toBeNull();
    await user.click(
      within(screen.getByTestId('operations-calendar-grid')).getByRole('button', {
        name: /Плановое ТО/,
      }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Плановое ТО' });
    expect(within(dialog).getByTestId('domain-event-details').textContent).toBe(
      'Подрядчик: maintenance-1',
    );
    expect(renderEventDetails).toHaveBeenCalledWith(baseEvent);
  });

  it('обновляет открытые детали по id и не открывает dialog повторно после удаления', async () => {
    const user = userEvent.setup();
    const props = createCalendarProps();
    const view = render(createElement(OperationsCalendar, props));
    const eventButton = within(screen.getByTestId('operations-calendar-grid')).getByRole('button', {
      name: /Плановое ТО/,
    });

    await user.click(eventButton);
    expect(screen.getByRole('dialog', { name: 'Плановое ТО' })).not.toBeNull();

    const updatedEvent = {
      ...baseEvent,
      title: 'Обновлённое ТО',
      vehicleLabel: 'PLT-002 · Haval',
      statusLabel: 'В работе',
      tone: 'warning' as const,
    };
    view.rerender(createElement(OperationsCalendar, { ...props, events: [updatedEvent] }));

    const updatedDialog = screen.getByRole('dialog', { name: 'Обновлённое ТО' });
    expect(updatedDialog.textContent).toContain('PLT-002 · Haval');
    expect(updatedDialog.textContent).toContain('В работе');

    view.rerender(createElement(OperationsCalendar, { ...props, events: [] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    view.rerender(createElement(OperationsCalendar, props));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('CalendarEventDialog', () => {
  it('показывает дату, автомобиль, статус и доменное действие', () => {
    render(
      createElement(CalendarEventDialog, {
        event: baseEvent,
        open: true,
        onOpenChange: vi.fn(),
        action: createElement(Button, null, 'Открыть запись'),
      }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Плановое ТО' });
    expect(dialog.textContent).toContain('22 июля 2026');
    expect(dialog.textContent).toContain('09:30');
    expect(dialog.textContent).toContain('PLT-001 · GWM WEY');
    expect(dialog.textContent).toContain('Запланировано');
    expect(within(dialog).getByRole('button', { name: 'Открыть запись' })).not.toBeNull();
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(dialog.innerHTML).toContain('break-words');
  });
});

describe('публичный API', () => {
  it('экспортирует календарь и dialog через barrel', () => {
    expect(operationsCalendar.OperationsCalendar).toBe(OperationsCalendar);
    expect(operationsCalendar.CalendarEventDialog).toBe(CalendarEventDialog);
  });
});
