// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DashboardDatePicker } from './DashboardDatePicker';

describe('DashboardDatePicker', () => {
  afterEach(cleanup);

  it('opens a calendar and submits one selected date', () => {
    render(<DashboardDatePicker selectionLabel="Сегодня" isCustom={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Выбрать дату или период' }));

    expect(screen.getByRole('dialog', { name: 'Выбор даты командного центра' })).toBeTruthy();
    expect(screen.getByLabelText('Дата').getAttribute('name')).toBe('from');
    expect(screen.queryByLabelText('Дата окончания')).toBeNull();
  });

  it('switches to a date range and keeps both form fields', () => {
    render(<DashboardDatePicker selectionLabel="Сегодня" isCustom={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать дату или период' }));
    fireEvent.click(screen.getByRole('button', { name: 'Период' }));

    expect(screen.getByLabelText('Дата начала').getAttribute('name')).toBe('from');
    expect(screen.getByLabelText('Дата окончания').getAttribute('name')).toBe('to');
    expect(screen.getByRole('button', { name: 'Показать' })).toBeTruthy();
  });

  it('shows the selected custom range beside the calendar', () => {
    render(<DashboardDatePicker selectionLabel="10.08.2026 — 14.08.2026" isCustom />);

    expect(screen.getByText('10.08.2026 — 14.08.2026')).toBeTruthy();
  });
});
