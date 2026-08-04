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
    expect(screen.queryByRole('button', { name: /добавить компанию|добавить пользователя/i })).toBeNull();
  });

  it('показывает честное пустое состояние аудита', () => {
    render(<AdminOverviewPage overview={{ ...overview, recentAudit: [] }} />);

    expect(screen.getByText('Действий пока нет')).toBeTruthy();
  });
});
