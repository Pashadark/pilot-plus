// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkdayEventsSection } from './WorkdayEventsSection';
import { loadWorkdayEvents } from './day-actions';
import type { DashboardWorkItemDto } from './overview-types';
import type { WorkdayCarouselItem } from './workday-carousel';
vi.mock('./day-actions', () => ({ loadWorkdayEvents: vi.fn() }));
vi.mock('./WorkdayVehicleEvents', () => ({
  WorkdayVehicleEvents: ({ items }: { items: WorkdayCarouselItem[] }) => (
    <div>
      {items.map((item) => (
        <p key={item.id}>
          {item.type === 'operation' ? item.operation.title : item.attention.title}
        </p>
      ))}
    </div>
  ),
}));
vi.mock('./WorkdayFleetCalendar', () => ({
  WorkdayFleetCalendar: ({ selected }: { selected: string }) => <p>Календарь {selected}</p>,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('switches a covered date instantly without a request', () => {
  render(
    <WorkdayEventsSection
      initialDay="2026-10-09"
      today="2026-10-09"
      initialDayCount={30}
      initialItems={[]}
      attentionItems={[]}
      fleet={[]}
    />,
  );
  fireEvent.click(screen.getByRole('link', { name: '2026-10-10' }));
  expect(screen.getByText('Календарь 2026-10-10')).toBeTruthy();
  expect(loadWorkdayEvents).not.toHaveBeenCalled();
});
it('does not let a late request replace the selected cached day', async () => {
  let complete!: (value: []) => void;
  vi.mocked(loadWorkdayEvents).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  render(
    <WorkdayEventsSection
      initialDay="2026-10-09"
      today="2026-10-09"
      initialDayCount={1}
      initialItems={[]}
      attentionItems={[]}
      fleet={[]}
    />,
  );
  fireEvent.change(screen.getByLabelText('Дата рабочего дня'), { target: { value: '2026-10-20' } });
  expect(screen.getByRole('status')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Дата рабочего дня'), { target: { value: '2026-10-09' } });
  await act(async () => complete([]));
  expect(screen.getByText('Календарь 2026-10-09')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
it('offers retry after an unsuccessful request', async () => {
  vi.mocked(loadWorkdayEvents)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([]);
  render(
    <WorkdayEventsSection
      initialDay="2026-10-09"
      today="2026-10-09"
      initialDayCount={1}
      initialItems={[]}
      attentionItems={[]}
      fleet={[]}
    />,
  );
  fireEvent.click(screen.getByRole('link', { name: '2026-10-10' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(loadWorkdayEvents).toHaveBeenCalledTimes(2);
});
it('does not overwrite newer cached results with a late request for the same date', async () => {
  const resolvers: Array<(items: DashboardWorkItemDto[]) => void> = [];
  vi.mocked(loadWorkdayEvents).mockImplementation(
    () => new Promise((resolve) => resolvers.push(resolve)),
  );
  render(
    <WorkdayEventsSection
      initialDay="2026-10-09"
      today="2026-10-09"
      initialDayCount={1}
      initialItems={[]}
      attentionItems={[]}
      fleet={[]}
    />,
  );
  const date = screen.getByLabelText('Дата рабочего дня');
  fireEvent.change(date, { target: { value: '2026-10-20' } });
  fireEvent.change(date, { target: { value: '2026-10-09' } });
  fireEvent.change(date, { target: { value: '2026-10-20' } });
  const item = {
    id: 'event',
    kind: 'RETURN',
    title: 'Свежие данные',
    scheduledAt: '2026-10-20T10:00:00Z',
    tone: 'warning',
    href: '/rentals/event',
    vehicleLabel: 'Kia K5',
    clientLabel: 'Клиент',
    phone: null,
    contractNumber: null,
    address: null,
    amountMinor: null,
    overdue: false,
  } as DashboardWorkItemDto;
  await act(async () => resolvers[1]([item]));
  await act(async () => resolvers[0]([{ ...item, title: 'Устаревшие данные' }]));
  fireEvent.change(date, { target: { value: '2026-10-09' } });
  fireEvent.change(date, { target: { value: '2026-10-20' } });
  expect(screen.getByText('Свежие данные')).toBeTruthy();
  expect(screen.queryByText('Устаревшие данные')).toBeNull();
});

it('shows deposit returns but keeps GPS-loss warnings out of the today carousel', () => {
  const deposit = {
    id: 'deposit-return:rental-1',
    kind: 'DEPOSIT_RETURN',
    scheduledAt: '2026-10-09T12:00:00Z',
    title: 'Вернуть депозит сегодня',
    tone: 'warning',
    href: '/rentals/rental-1',
    vehicleLabel: 'Kia K5 · Р044ЕА323',
    clientLabel: 'Клиент',
    phone: null,
    contractNumber: 'ME-1',
    address: null,
    amountMinor: '2000000',
    overdue: false,
  } satisfies DashboardWorkItemDto;
  render(
    <WorkdayEventsSection
      initialDay="2026-10-09"
      today="2026-10-09"
      initialDayCount={1}
      initialItems={[deposit]}
      attentionItems={[
        {
          id: 'offline:vehicle-1',
          tone: 'warning',
          title: 'Нет актуального GPS-сигнала',
          description: 'Kia K5',
          href: '/vehicles/vehicle-1',
        },
      ]}
      fleet={[]}
    />,
  );

  expect(screen.getByText('Вернуть депозит сегодня')).toBeTruthy();
  expect(screen.queryByText('Нет актуального GPS-сигнала')).toBeNull();
});
