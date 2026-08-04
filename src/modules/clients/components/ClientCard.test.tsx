// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClientCard } from './ClientCard';

describe('ClientCard', () => {
  it('keeps the photo left of client data and provides an accessible Telegram link', () => {
    render(
      <ClientCard
        client={{
          id: 'client-1',
          companyId: 'company-1',
          fullName: 'Анна Воронова',
          email: 'anna@example.test',
          phoneMasked: '+7 ••• •••-12-34',
          passportMasked: null,
          driverLicenseMasked: '12 ••• 456',
          driverLicenseExpiresAt: null,
          status: 'VERIFIED',
          updatedAt: '2026-08-04T10:00:00.000Z',
          localPhotoUrl: null,
          telegramUrl: null,
        }}
        messenger={{ type: 'telegram', href: 'https://t.me/anna', confirmedAvatarUrl: null }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Анна Воронова' })).toBeTruthy();
    expect(screen.getByTestId('client-photo').getAttribute('data-source')).toBe('placeholder');
    expect(screen.getByRole('link', { name: 'Написать в Telegram' }).getAttribute('href')).toBe(
      'https://t.me/anna',
    );
    expect(screen.getByTestId('client-card').className).toContain(
      'grid-cols-[5.5rem_minmax(0,1fr)]',
    );
  });
});
