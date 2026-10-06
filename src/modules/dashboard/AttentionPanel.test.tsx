// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AttentionPanel } from './AttentionPanel';

afterEach(cleanup);

describe('AttentionPanel', () => {
  it('groups repeated GPS problems into one actionable row', () => {
    render(
      <AttentionPanel
        items={[
          {
            id: 'offline:car-1',
            tone: 'warning',
            title: 'Нет актуального GPS-сигнала',
            description: 'Kia K5 · А001АА777',
            href: '/vehicles/car-1',
          },
          {
            id: 'offline:car-2',
            tone: 'warning',
            title: 'Нет актуального GPS-сигнала',
            description: 'Kia Rio · А002АА777',
            href: '/vehicles/car-2',
          },
        ]}
      />,
    );

    expect(screen.getAllByText(/Нет актуального GPS-сигнала/)).toHaveLength(1);
    expect(screen.getByText('2 автомобиля')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Нет актуального GPS-сигнала/ }).getAttribute('href'),
    ).toBe('/vehicles?gps=offline');
  });

  it('keeps non-GPS actions as separate rows', () => {
    render(
      <AttentionPanel
        items={[
          {
            id: 'overdue:rental-1',
            tone: 'danger',
            title: 'Завершить аренду',
            description: 'ME-2026-001 · просрочено',
            href: '/rentals/rental-1',
          },
        ]}
      />,
    );

    expect(screen.getByText('Завершить аренду')).toBeTruthy();
  });
});
