// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommandCenterDashboard } from './CommandCenterDashboard';
import type { DashboardOverviewDto } from './overview-types';

function overviewFixture(overrides: Partial<DashboardOverviewDto> = {}): DashboardOverviewDto {
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
      maintenanceVehicles: 1,
      repairVehicles: 2,
      washVehicles: 3,
      contracts: 42,
      clients: 37,
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
    expect(screen.queryByRole('heading', { name: 'Требует внимания' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Вернуть депозит' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Вернуть депозит/i }).getAttribute('href')).toBe(
      '/rentals/rental-1',
    );
  });

  it('shows an honest phone fallback on a deposit return', () => {
    const fixture = overviewFixture();
    const item = fixture.workItems[0];

    render(
      <CommandCenterDashboard
        overview={{
          ...fixture,
          workItems: item ? [{ ...item, title: 'Вернуть депозит сегодня', phone: null }] : [],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Вернуть депозит' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Вернуть депозит Kia Rio/ }));
    expect(screen.getByText('Нет телефона')).toBeTruthy();
    expect(screen.getAllByText(/15\s*000\s*₽/).length).toBeGreaterThan(0);
    expect(screen.getByText('ME-2026-0015-II')).toBeTruthy();
  });

  it('explains an empty day instead of rendering an empty list', () => {
    render(<CommandCenterDashboard overview={overviewFixture({ workItems: [] })} />);
    expect(screen.getByText('Срочных задач нет')).toBeTruthy();
  });

  it('shows lifetime contract money separately from deposits and exposes period navigation', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} />);
    expect(screen.getByText('Заработано за всё время')).toBeTruthy();
    expect(screen.getByText(/186\s*802\s*₽/)).toBeTruthy();
    expect(screen.getByText('Залоги к возврату')).toBeTruthy();
    expect(screen.queryByText(/275\s*000\s*₽/)).toBeNull();
    expect(screen.getAllByText(/15\s*000\s*₽/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Завтра' }).getAttribute('href')).toBe(
      '/?period=tomorrow',
    );
    expect(screen.getByRole('link', { name: 'Месяц' }).getAttribute('href')).toBe('/?period=month');
  });

  it('links primary creation actions to existing workflows', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} />);
    expect(screen.getByRole('link', { name: /новый клиент/i }).getAttribute('href')).toBe(
      '/clients?form=new',
    );
    expect(screen.getByRole('link', { name: /новая аренда/i }).getAttribute('href')).toBe(
      '/rentals/new',
    );
  });

  it('places compact Moscow weather first in the KPI grid', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} weather={null} />);
    const grid = screen.getByLabelText('Показатели автопарка');
    expect(grid.firstElementChild?.getAttribute('aria-label')).toBe('Погода в Москве');
    expect(grid.textContent).toContain('Свободно');
  });

  it('places KPI cards above the period navigation', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} weather={null} />);
    const cards = screen.getByLabelText('Показатели автопарка');
    const periods = screen.getByRole('navigation', { name: 'Период командного центра' });
    expect(cards.compareDocumentPosition(periods) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds operational and registry KPI cards in the existing dashboard grid', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} weather={null} />);

    expect(screen.getByRole('link', { name: /ТО.*На обслуживании/i }).getAttribute('href')).toBe(
      '/maintenance?view=list',
    );
    expect(
      screen.getByRole('link', { name: /Ремонт.*Сейчас в работе/i }).getAttribute('href'),
    ).toBe('/maintenance?view=list');
    expect(screen.getByRole('link', { name: /Мойка.*На мойке сейчас/i }).getAttribute('href')).toBe(
      '/wash',
    );
    expect(
      screen.getByRole('link', { name: /Договоры.*Всего в системе/i }).getAttribute('href'),
    ).toBe('/rentals');
    expect(screen.getByRole('link', { name: /Клиенты.*Всего в базе/i }).getAttribute('href')).toBe(
      '/clients',
    );
  });

  it('does not duplicate sidebar navigation below the dashboard', () => {
    render(<CommandCenterDashboard overview={overviewFixture()} weather={null} />);
    expect(screen.queryByRole('navigation', { name: 'Подробные разделы' })).toBeNull();
  });

  it('labels a lead without a follow-up time instead of rendering a fake time', () => {
    render(
      <CommandCenterDashboard
        overview={overviewFixture({
          workItems: [
            {
              id: 'lead:lead-1',
              kind: 'LEAD',
              scheduledAt: '2026-08-24T08:00:00.000Z',
              title: 'Связаться по заявке',
              tone: 'info',
              href: '/leads',
              vehicleLabel: 'Петрова Анна',
              clientLabel: 'Источник: ВКонтакте',
              phone: '+79991112233',
              contractNumber: null,
              address: null,
              amountMinor: null,
              overdue: false,
              unscheduled: true,
            },
          ],
        })}
      />,
    );

    expect(screen.getAllByText('Без срока').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Петрова Анна/).length).toBeGreaterThan(0);
  });
});
