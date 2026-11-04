// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkdayAttention } from './WorkdayAttention';
const items = Array.from({ length: 7 }, (_, i) => ({
  id: `${i}`,
  title: `Событие ${i}`,
  description: `Машина ${i}`,
  href: `/vehicles/${i}`,
  tone: 'warning' as const,
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('shows three, advances after five seconds and pauses while hovered', () => {
  vi.useFakeTimers();
  render(<WorkdayAttention items={items} />);
  expect(screen.getByRole('link', { name: /Событие 0/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Событие 3/ })).toBeNull();
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole('link', { name: /Событие 3/ })).toBeTruthy();
  fireEvent.mouseEnter(screen.getByRole('region', { name: 'Требуют внимания' }));
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole('link', { name: /Событие 3/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Следующие предупреждения' }));
  expect(screen.getByRole('link', { name: /Событие 6/ })).toBeTruthy();
});
it('does not rotate small lists and allows opening all warnings', () => {
  render(<WorkdayAttention items={items.slice(0, 2)} />);
  expect(screen.queryByRole('button', { name: 'Следующие предупреждения' })).toBeNull();
  cleanup();
  render(<WorkdayAttention items={items} />);
  fireEvent.click(screen.getByRole('button', { name: 'Все предупреждения' }));
  expect(screen.getByRole('dialog', { name: 'Все предупреждения' })).toBeTruthy();
  expect(screen.getAllByRole('link', { name: /Событие 6/ })).toHaveLength(1);
});
