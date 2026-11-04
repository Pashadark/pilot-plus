// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkdayDateStrip } from './WorkdayDateStrip';
afterEach(cleanup);
describe('WorkdayDateStrip', () => {
  it('can select a day locally without page navigation', () => {
    const select = vi.fn();
    render(<WorkdayDateStrip selected="2026-10-08" onSelect={select} />);
    fireEvent.click(screen.getByRole('link', { name: '2026-10-09' }));
    expect(select).toHaveBeenCalledWith('2026-10-09');
  });
  it('links dates to server-filtered workday and pages across month boundaries', () => {
    render(<WorkdayDateStrip selected="2026-10-08" />);
    expect(screen.getByRole('link', { name: '2026-10-08' }).getAttribute('aria-current')).toBe(
      'date',
    );
    expect(screen.getByRole('link', { name: '2026-10-09' }).getAttribute('href')).toBe(
      '/?from=2026-10-09',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущие 7 дней' }));
    expect(screen.getByRole('link', { name: '2026-10-01' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущие 7 дней' }));
    expect(screen.getByRole('link', { name: '2026-09-24' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Следующие 7 дней' }));
    expect(screen.getByRole('link', { name: '2026-10-01' })).toBeTruthy();
  });
});
