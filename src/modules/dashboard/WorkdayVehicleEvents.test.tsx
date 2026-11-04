// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkdayCarouselItem } from './workday-carousel';
import { WorkdayVehicleEvents } from './WorkdayVehicleEvents';

const scrollBy = vi.fn();

beforeEach(() => {
  scrollBy.mockReset();
  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: { configurable: true, get: () => 600 },
    scrollWidth: { configurable: true, get: () => 920 },
    scrollLeft: { configurable: true, get: () => 0 },
    scrollBy: { configurable: true, value: scrollBy },
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 280,
    height: 240,
    top: 0,
    right: 280,
    bottom: 240,
    left: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([], this as unknown as ResizeObserver);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function depositItem(): Extract<WorkdayCarouselItem, { type: 'operation' }> {
  return {
    id: 'operation:deposit-return:rental-1',
    type: 'operation',
    operation: {
      id: 'deposit-return:rental-1',
      kind: 'DEPOSIT_RETURN',
      scheduledAt: '2026-10-11T14:00:00.000Z',
      title: 'Вернуть депозит сегодня',
      tone: 'warning',
      href: '/rentals/rental-1',
      vehicleLabel: 'Kia K5 · Р044ЕА323',
      clientLabel: 'Горбунов Артём Денисович',
      phone: null,
      contractNumber: 'ME-2026-0090-GA',
      address: null,
      amountMinor: '2000000',
      overdue: false,
    },
  };
}

describe('WorkdayVehicleEvents', () => {
  it('shows a deposit action with the amount and client', async () => {
    render(<WorkdayVehicleEvents items={[depositItem()]} fleet={[]} />);

    expect(screen.getByText('20 000 ₽')).toBeTruthy();
    expect(screen.getByText('Горбунов Артём Денисович')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Вернуть депозит' }).getAttribute('href')).toBe(
      '/rentals/rental-1',
    );
  });

  it('scrolls one card with overlay controls and keyboard arrows', async () => {
    const second = depositItem();
    second.id = 'operation:deposit-return:rental-2';
    second.operation = { ...second.operation, id: 'deposit-return:rental-2' };
    render(<WorkdayVehicleEvents items={[depositItem(), second]} fleet={[]} />);

    const next = await screen.findByRole('button', { name: 'Следующие карточки' });
    expect(screen.queryByRole('button', { name: 'Предыдущие карточки' })).toBeNull();
    fireEvent.click(next);
    expect(scrollBy).toHaveBeenCalledWith({ left: 294, behavior: 'smooth' });

    fireEvent.keyDown(screen.getByRole('region', { name: 'Оперативные события' }), {
      key: 'ArrowRight',
    });
    await waitFor(() => expect(scrollBy).toHaveBeenCalledTimes(2));
  });
});
