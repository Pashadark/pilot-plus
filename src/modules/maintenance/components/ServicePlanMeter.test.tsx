// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const actions = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock('../service-plan-actions', () => ({ readServicePlan: actions.read, saveServicePlan: actions.save }));
import { ServicePlanMeter } from './ServicePlanMeter';
afterEach(cleanup);
it('compact meter takes one cell and has no edit button', async () => {
  actions.read.mockResolvedValue({ canEdit: true, current: 95000, record: { id: 'r', last: 90000, next: 100000, date: '', version: 'v' } });
  const { container } = render(<ServicePlanMeter vehicleId="v" compact />);
  await screen.findByRole('progressbar');
  expect(screen.queryByRole('button', { name: 'Изменить ТО' })).toBeNull();
  expect(container.firstElementChild?.className).not.toContain('col-span-2');
});
it('shows remaining mileage and edits last/next/date', async () => {
  actions.read.mockResolvedValue({ canEdit: true, current: 95000, record: { id: 'r', last: 90000, next: 100000, date: '2027-01-01', version: 'v' } });
  actions.save.mockResolvedValue({ ok: true, message: 'Сохранено' });
  render(<ServicePlanMeter vehicleId="v" />);
  expect(await screen.findByRole('progressbar')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  fireEvent.click(screen.getByRole('button', { name: 'Изменить ТО' }));
  expect(screen.getByLabelText('Пробег последнего ТО, км')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Пробег следующего ТО, км'), { target: { value: '110000' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Сохранить' }).closest('form')!);
  await waitFor(() => expect(actions.save).toHaveBeenCalledOnce());
  expect(actions.save.mock.calls[0][1].get('next')).toBe('110000');
});
