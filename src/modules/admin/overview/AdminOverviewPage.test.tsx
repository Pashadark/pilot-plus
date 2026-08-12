// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdminOverviewPage } from './AdminOverviewPage';

afterEach(cleanup);

const overview = {
  scope: 'SYSTEM' as const,
  companies: 3,
  users: 7,
  vehicles: 19,
  devices: 11,
  companyProfiles: [],
  recentAudit: [
    {
      id: 'audit-1',
      actorLabel: 'Павел Седов',
      action: 'UPDATE' as const,
      entityType: 'VEHICLE' as const,
      entityLabel: 'PLT-001',
      companyLabel: 'Pilot+',
      createdAt: '2026-08-04T08:00:00.000Z',
    },
  ],
};

const companyProfile = {
  id: 'company-1',
  name: 'ООО «Север Транс Мониторинг»',
  inn: '2465357184',
  kpp: '246501001',
  ogrn: '1242400017356',
  directorName: 'Александр Сергеевич Лебедев',
  legalAddress: 'Красноярск, ул. Карла Маркса, д. 93',
  actualAddress: 'Красноярск, ул. Шахтёров, д. 33',
  phone: '+7 (391) 205-17-40',
  email: 'office@sever-trans.demo',
  isDemo: true,
  team: [
    {
      id: 'member-1',
      name: 'Анна Воронцова',
      email: 'anna.vorontsova@sever-trans.demo',
      role: 'COMPANY_ADMIN' as const,
      isActive: false,
    },
  ],
};

describe('AdminOverviewPage', () => {
  it('показывает русскую сводку, scope и только существующие быстрые действия', () => {
    render(<AdminOverviewPage overview={overview} />);

    expect(screen.getByRole('heading', { name: 'Центр управления' })).toBeTruthy();
    expect(screen.getByText('Системный уровень')).toBeTruthy();
    for (const label of ['Компании', 'Пользователи', 'Автомобили', 'Устройства']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByTestId('admin-overview-kpi')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Открыть автопарк' }).getAttribute('href')).toBe(
      '/vehicles',
    );
    expect(screen.getByRole('link', { name: 'Открыть устройства' }).getAttribute('href')).toBe(
      '/devices',
    );
    expect(screen.getByRole('link', { name: 'Проверить систему' }).getAttribute('href')).toBe(
      '/system',
    );
    expect(screen.getByText('Павел Седов')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /добавить компанию|добавить пользователя/i }),
    ).toBeNull();
  });

  it('показывает честное пустое состояние аудита', () => {
    render(<AdminOverviewPage overview={{ ...overview, recentAudit: [] }} />);

    expect(screen.getByText('Действий пока нет')).toBeTruthy();
  });

  it('показывает русское название нового действия аудита', () => {
    render(
      <AdminOverviewPage
        overview={{
          ...overview,
          recentAudit: [{ ...overview.recentAudit[0], action: 'VIEW' as const }],
        }}
      />,
    );

    expect(screen.getByText(/Просмотр/)).toBeTruthy();
  });

  it('показывает компании и их команды после показателей', () => {
    render(<AdminOverviewPage overview={{ ...overview, companyProfiles: [companyProfile] }} />);

    expect(screen.getByRole('heading', { name: 'Компании и команда' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ООО «Север Транс Мониторинг»' })).toBeTruthy();
    expect(screen.getByText('2465357184')).toBeTruthy();
    expect(screen.getByText('Анна Воронцова')).toBeTruthy();
  });

  it('показывает пустое состояние компании при отсутствии доступных профилей', () => {
    render(<AdminOverviewPage overview={overview} />);

    expect(screen.getByText('Доступные компании пока не найдены')).toBeTruthy();
  });
});
