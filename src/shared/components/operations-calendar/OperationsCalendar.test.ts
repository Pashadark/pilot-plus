import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/shared/ui';

import { CalendarEventDialog } from './CalendarEventDialog';
import { OperationsCalendar } from './OperationsCalendar';
import type { OperationsCalendarEvent } from './types';
import * as operationsCalendar from '.';

const baseEvent: OperationsCalendarEvent = {
  id: 'maintenance-1',
  startsAt: '2026-07-22T06:30:00.000Z',
  title: 'Плановое ТО',
  vehicleLabel: 'PLT-001 · GWM WEY',
  statusLabel: 'Запланировано',
  tone: 'primary',
  icon: 'tool',
};

const defaultProps = {
  events: [baseEvent],
  month: '2026-07',
  onMonthChange: vi.fn(),
  onToday: vi.fn(),
};

describe('OperationsCalendar', () => {
  it('публикует контракты desktop-сетки и мобильной повестки', () => {
    const html = renderToStaticMarkup(createElement(OperationsCalendar, defaultProps));

    expect(html).toContain('data-testid="operations-calendar-grid"');
    expect(html).toContain('data-testid="operations-calendar-agenda"');
    expect(html).toContain('Понедельник');
    expect(html).toContain('Июль 2026');
    expect(html).toMatch(
      /data-testid="operations-calendar-grid"[^>]+class="[^"]*\bhidden\b[^"]*\bmd:grid\b/,
    );
    expect(html).toMatch(/data-testid="operations-calendar-agenda"[^>]+class="[^"]*\bmd:hidden\b/);
  });

  it('показывает первые три записи и раскрывает остаток дня', () => {
    const events = Array.from({ length: 4 }, (_, index) => ({
      ...baseEvent,
      id: `maintenance-${index + 1}`,
      title: `Работа ${index + 1}`,
      startsAt: `2026-07-22T0${index + 5}:30:00.000Z`,
    }));
    const html = renderToStaticMarkup(
      createElement(OperationsCalendar, { ...defaultProps, events }),
    );

    expect(html).toContain('Ещё 1');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Работа 1');
    expect(html).toContain('Работа 3');
    expect(html).not.toContain('Работа 4');
    expect(html).toContain('data-testid="operations-calendar-event-status"');
  });

  it('даёт клавиатурно-доступные названия навигации и не уменьшает touch-target', () => {
    const html = renderToStaticMarkup(createElement(OperationsCalendar, defaultProps));

    expect(html).toContain('aria-label="Предыдущий месяц"');
    expect(html).toContain('aria-label="Следующий месяц"');
    expect(html).toContain('>Сегодня</button>');
    expect(html).toContain('min-h-11');
    expect(html).toContain('motion-reduce:transition-none');
  });
});

describe('CalendarEventDialog', () => {
  it('показывает дату, автомобиль, статус и доменное действие', () => {
    const html = renderToStaticMarkup(
      createElement(CalendarEventDialog, {
        event: baseEvent,
        open: true,
        onOpenChange: vi.fn(),
        action: createElement(Button, null, 'Открыть запись'),
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Плановое ТО');
    expect(html).toContain('22 июля 2026');
    expect(html).toContain('09:30');
    expect(html).toContain('PLT-001 · GWM WEY');
    expect(html).toContain('Запланировано');
    expect(html).toContain('Открыть запись');
    expect(html).toContain('max-h-[calc(100dvh-2rem)]');
    expect(html).toContain('break-words');
  });
});

describe('публичный API', () => {
  it('экспортирует календарь и диалог через barrel', () => {
    expect(operationsCalendar.OperationsCalendar).toBe(OperationsCalendar);
    expect(operationsCalendar.CalendarEventDialog).toBe(CalendarEventDialog);
  });
});
