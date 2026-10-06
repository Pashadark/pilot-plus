// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { VehicleMaintenanceHistorySummary } from '../types';
import { VehicleMaintenanceWorkspace } from './VehicleMaintenanceWorkspace';

afterEach(cleanup);
const record: VehicleMaintenanceHistorySummary = {
  id: 'r1',
  title: 'Замена масла АКПП',
  kind: 'OIL',
  recordType: 'MAINTENANCE',
  status: 'COMPLETED',
  scheduledAt: null,
  completedAt: '2026-09-15T21:00:00Z',
  targetOdometerKm: null,
  provider: 'Автокомфорт',
  costMinor: 3875000,
  workItems: [
    {
      id: 'w',
      title: 'Плановое ТО',
      description: 'Работа: 4 нормо-ч × 1000 ₽; скидка 0.',
      costMinor: 400000,
    },
    {
      id: 'p',
      title: 'Масло',
      description: 'Материал: количество 6 × 1500 ₽ за единицу; скидка 0.',
      costMinor: 900000,
    },
    { id: 'u', title: 'Диагностика', description: null, costMinor: null },
  ],
  attachments: [
    {
      id: 'a',
      kind: 'DOCUMENT',
      originalName: 'Заказ.jpg',
      isImage: true,
      url: '/maintenance/r1/attachments/a',
    },
  ],
};

it('renders completed date, separate tables and an explicit download, without washes', () => {
  render(<VehicleMaintenanceWorkspace vehicleId="v" records={[record]} />);
  expect(screen.getAllByText('16 сентября 2026').length).toBeGreaterThan(0);
  expect(
    within(screen.getByRole('table', { name: 'Работы' })).getByText('Плановое ТО'),
  ).toBeTruthy();
  expect(
    within(screen.getByRole('table', { name: 'Запчасти и материалы' })).getByText('Масло'),
  ).toBeTruthy();
  expect(screen.getByRole('table', { name: 'Прочие позиции' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Скачать заказ-наряд/ }).getAttribute('href')).toBe(
    '/maintenance/r1/attachments/a?download=1',
  );
  expect(screen.queryByText('История моек')).toBeNull();
});

it('selects repairs and sorts newest first without retaining stale detail', () => {
  const newer = {
    ...record,
    id: 'r2',
    title: 'Тормоза',
    completedAt: '2026-09-20T21:00:00Z',
    workItems: [],
    attachments: [],
  };
  render(<VehicleMaintenanceWorkspace vehicleId="v" records={[record, newer]} />);
  expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Тормоза');
  fireEvent.click(screen.getByRole('button', { name: /Замена масла АКПП/ }));
  expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Замена масла АКПП');
});

it('keeps absent prices unknown and does not invent dates', () => {
  render(
    <VehicleMaintenanceWorkspace
      vehicleId="v"
      records={[{ ...record, completedAt: null, costMinor: null }]}
    />,
  );
  expect(screen.getAllByText('Дата не указана').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Не указана').length).toBeGreaterThan(0);
});

it('provides honest empty state', () => {
  render(<VehicleMaintenanceWorkspace vehicleId="v" records={[]} />);
  expect(screen.getByText('Обслуживание ещё не запланировано')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
});
