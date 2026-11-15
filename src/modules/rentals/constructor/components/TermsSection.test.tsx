// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TermsSection } from './TermsSection';

afterEach(cleanup);

describe('TermsSection', () => {
  it('uses canonical rental and mileage calculations', () => {
    render(
      <TermsSection
        state={{
          agreementType: 'STANDARD',
          clientMode: 'existing',
          startsAt: '2026-11-20T10:00',
          endsAt: '2026-11-22T10:00',
          dailyRateMinor: 300000,
          discountMinor: 0,
          servicesMinor: 0,
          depositMinor: 1500000,
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('2 суток')).toBeTruthy();
    expect(screen.getByText('6 000 ₽')).toBeTruthy();
    expect(screen.getByText('400 км на весь договор')).toBeTruthy();
  });

  it('removes the mileage limit for lease-to-own agreements', () => {
    render(
      <TermsSection
        state={{
          agreementType: 'LEASE_TO_OWN',
          clientMode: 'existing',
          startsAt: '2026-11-20T10:00',
          endsAt: '2026-11-22T10:00',
          dailyRateMinor: 300000,
          discountMinor: 0,
          servicesMinor: 0,
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Без лимита для аренды с выкупом')).toBeTruthy();
  });
});
