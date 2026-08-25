// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommandCenterDashboard } from './CommandCenterDashboard';
import type { DashboardOverviewDto } from './overview-types';

function overviewFixture(
  overrides: Partial<DashboardOverviewDto> = {},
): DashboardOverviewDto {
  return {
    period: {
      key: 'today',
      label: 'Сегодня',
      from: '2026-08-24T21:00:00.000Z',
      toExclusive: '2026-08-25T21:00:00.000Z',
    },
    kpis: {
      earnedMinor: '400000',
      earnedIsEstimated: true,
      lifetimeEarnedMinor: '18680200',
      lifetimeDepositsMinor: '27500000',
      heldDepositsMinor: '1500000',
      freeVehicles: 4,
      occupiedVehicles: 5,
      serviceVehicles: 1,
      offlineVehicles: 2,
    },
    workItems: [
      {
        id: 'deposit-return:rental-1',
        kind: 'DEPOSIT_RETURN',
        scheduledAt: '2026-08-25T09:00:00.000Z',
        title: 'Вернуть депозит',
        tone: 'warning',
        href: '/rentals/rental-1',
        vehicleLabel: 'Kia Rio · А001АА777',
        clientLabel: 'Иванов Иван',
        phone: '+79990000000',
        contractNumber: 'ME-2026-0015-II',
        address: null,
        amountMinor: '1500000',
        overdue: false,
      },
    ],
    attentionItems: [
      {
        id: 'attention:rental-1',
        tone: 'warning',
        title: 'Депозит ожидает возврата',
        description: 'ME-2026-0015-II · 15 000 ₽',
        href: '/rentals/rental-1',
      },
    ],
    ...overrides,
  };
}

describe('CommandCenterDashboard', () => {
  afterEach(cleanup);

  it('renders the operational priority before analytics', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} />);
    expect(screen.getByRole('heading', { name: 'Рабочий день' })).toBeTruthy();
    expect(screen.getByText('Вернуть депозит')).toBeTruthy();
    expect(screen.getByRole('link', { name: /открыть договор/i }).getAttribute('href')).toBe(
      '/rentals/rental-1',
    );
  });

  it('explains an empty day instead of rendering an empty list', () => {
    render(<CommandCenterDashboard overview={overviewFixture({ workItems: [] })} />);
    expect(screen.getByText('На выбранный день обязательных действий нет')).toBeTruthy();
  });

  it('shows lifetime contract money separately from deposits and exposes period navigation', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} />);
    expect(screen.getByText('Заработано за всё время')).toBeTruthy();
    expect(screen.getByText(/186\s*802\s*₽/)).toBeTruthy();
    expect(screen.getByText('Депозиты по договорам')).toBeTruthy();
    expect(screen.getByText(/275\s*000\s*₽/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Завтра' }).getAttribute('href')).toBe(
      '/?period=tomorrow',
    );
  });
});
