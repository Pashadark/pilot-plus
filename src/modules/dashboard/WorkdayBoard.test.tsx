// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkdayBoard } from './WorkdayBoard';
import type { DashboardWorkItemDto } from './overview-types';
vi.mock('./task-actions', () => ({ completeOperationsTaskAction: vi.fn() }));
const make = (id: string, overrides = {}): DashboardWorkItemDto => ({
  id,
  kind: 'DEPOSIT_RETURN',
  scheduledAt: '2026-09-22T10:00:00Z',
  title: 'Вернуть депозит',
  tone: 'warning',
  href: `/rentals/${id}`,
  vehicleLabel: `Авто ${id}`,
  clientLabel: `Клиент ${id}`,
  phone: null,
  contractNumber: null,
  address: null,
  amountMinor: '2000000',
  overdue: false,
  ...overrides,
});
afterEach(cleanup);
describe('WorkdayBoard priorities', () => {
  it('renders groups and selects a different item without navigation', () => {
    render(
      <WorkdayBoard
        now="2026-09-22T09:00:00Z"
        items={[make('one'), make('two', { scheduledAt: '2026-09-23T10:00:00Z' })]}
      />,
    );
    expect(screen.getByRole('heading', { name: /Далее сегодня/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Сделать сейчас/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Завтра/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Авто two/ }));
    for (const detail of screen.getAllByRole('region', { name: 'Выбранная задача' })) {
      expect(within(detail).getByText('Клиент two')).toBeTruthy();
      expect(
        within(detail)
          .getByRole('link', { name: /Открыть договор/ })
          .getAttribute('href'),
      ).toBe('/rentals/two');
    }
  });
  it('filters leads and does not retain a hidden selected deposit', () => {
    render(
      <WorkdayBoard
        now="2026-09-22T09:00:00Z"
        items={[
          make('one'),
          make('lead', {
            kind: 'LEAD',
            unscheduled: true,
            title: 'Связаться по заявке',
            amountMinor: null,
            href: '/leads',
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Заявки/ }));
    expect(screen.getByText('Клиент lead')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Авто one/ })).toBeNull();
  });
  it('shows distinct actions, separate plates and no duplicate urgent rows', () => {
    render(
      <WorkdayBoard
        now="2026-09-22T09:00:00Z"
        items={[
          make('overdue', {
            kind: 'RETURN',
            overdue: true,
            title: 'Принять возврат автомобиля',
            vehicleLabel: 'Toyota Camry · Р957АН997',
          }),
          make('issue', { kind: 'HANDOVER', title: 'Выдать автомобиль' }),
          make('fine', { kind: 'FINE', title: 'Скидка заканчивается сегодня' }),
        ]}
      />,
    );
    expect(screen.getByText('Р957АН997')).toBeTruthy();
    expect(screen.getAllByText('Toyota Camry')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Выдать автомобиль' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Оплатить штраф' })).toBeTruthy();
    expect(screen.queryByText(/Toyota Camry ·/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Выбранная задача' })).toBeNull();
  });
  it('keeps kopecks in fine amounts', () => {
    render(
      <WorkdayBoard
        now="2026-09-22T09:00:00Z"
        items={[make('fine', { kind: 'FINE', amountMinor: '56250' })]}
      />,
    );
    expect(screen.getByText(/562,5(?:0)?\s*₽/)).toBeTruthy();
  });
  it('limits priority cards to three without losing the remaining tasks', () => {
    render(
      <WorkdayBoard
        now="2026-09-22T09:00:00Z"
        items={Array.from({ length: 7 }, (_, index) => make(`deposit-${index}`))}
      />,
    );
    expect(
      within(screen.getByRole('region', { name: 'Сделать сейчас' })).getAllByRole('article'),
    ).toHaveLength(3);
    expect(
      within(screen.getByRole('region', { name: 'Далее сегодня' })).getAllByRole('listitem'),
    ).toHaveLength(4);
    expect(screen.getAllByRole('link', { name: 'Вернуть депозит' })).toHaveLength(7);
  });
});
