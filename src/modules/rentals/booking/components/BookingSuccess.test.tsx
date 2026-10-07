import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, element: string) =>
        ({ children, ...props }: { children?: React.ReactNode }) => {
          const Component = element as React.ElementType;
          return <Component {...props}>{children}</Component>;
        },
    },
  ),
  useReducedMotion: () => false,
}));

import { BookingSuccess } from './BookingSuccess';

describe('BookingSuccess', () => {
  it('shows success and a single confetti burst', () => {
    render(
      <BookingSuccess
        rentalId="rental-1"
        contractNumber="ME-2026-0081-BK"
        vehicle="Kia Ceed А429АУ997"
        period="15–18 ноября"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Бронирование создано')).toBeTruthy();
    expect(screen.getByTestId('booking-confetti')).toBeTruthy();
  });
});
// @vitest-environment jsdom
