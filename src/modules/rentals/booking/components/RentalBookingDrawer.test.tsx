import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('../server/actions', () => ({
  saveBookingDraftAction: vi.fn(),
  confirmBookingAction: vi.fn(),
}));

import { RentalBookingDrawer } from './RentalBookingDrawer';

describe('RentalBookingDrawer', () => {
  beforeEach(() => {
    cleanup();
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
  });

  it('renders a four-step booking dialog in the Pilot layout', () => {
    render(
      <RentalBookingDrawer
        workspace={{
          companyId: 'company-1',
          templateVersionId: 'template-1',
          clients: [],
          vehicles: [],
        }}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Новое бронирование' })).toBeTruthy();
    expect(screen.getAllByTestId('booking-step')).toHaveLength(4);
    expect(screen.getAllByTestId('booking-step-arrow')).toHaveLength(3);
    expect(screen.getAllByTestId('booking-step-marker').map((marker) => marker.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(screen.getAllByTestId('booking-step')[0].getAttribute('data-state')).toBe('current');
    expect((screen.getByRole('button', { name: 'Далее' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('hides immediately before navigating away when closed', async () => {
    render(
      <RentalBookingDrawer
        workspace={{
          companyId: 'company-1',
          templateVersionId: 'template-1',
          clients: [],
          vehicles: [],
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(screen.queryByRole('dialog', { name: 'Новое бронирование' })).toBeNull();
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith('/rentals?status=CONFIRMED', {
      scroll: false,
    });
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});
// @vitest-environment jsdom
