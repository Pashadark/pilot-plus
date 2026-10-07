import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../server/actions', () => ({
  saveBookingDraftAction: vi.fn(),
  confirmBookingAction: vi.fn(),
}));

import { RentalBookingDrawer } from './RentalBookingDrawer';

describe('RentalBookingDrawer', () => {
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
    expect((screen.getByRole('button', { name: 'Далее' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
// @vitest-environment jsdom
